const firebaseConfig = {
    apiKey: "AIzaSyAITObyrVqlldNoKEckKmNoIJrmsUeEoVo",
    authDomain: "ah-shopping-7161d.firebaseapp.com",
    projectId: "ah-shopping-7161d",
    storageBucket: "ah-shopping-7161d.firebasestorage.app",
    messagingSenderId: "941881580369",
    appId: "1:941881580369:web:0ea5511eaa6cec86c6d170",
    measurementId: "G-1M7NTWJNS2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(console.error);

let maintenanceCheckInterval = null;

async function getAdminEmail() {
    try {
        const adminDoc = await db.collection("admin").doc("credentials").get();
        if (adminDoc.exists) {
            return adminDoc.data().email;
        }
    } catch (error) {
        console.error('Error fetching admin email:', error);
    }
    return 'admin@gmail.com';
}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'admin_login.html';
        return;
    }
    
    const adminEmail = await getAdminEmail();
    
    if (user.email !== adminEmail) {
        alert('Access denied. You are not authorized to view this page.');
        auth.signOut();
        window.location.href = 'admin_login.html';
        return;
    }
    
    setupAdminProfile(user);
    loadMaintenanceStatus();
    startMaintenanceStatusUpdates();
});

function setupAdminProfile(user) {
    const profile = document.querySelector('.user-profile');
    if (profile) {
        profile.innerHTML = `
            <span style="color:#ff4d4d; font-weight:bold;">Admin: ${user.email}</span>
            <button onclick="logout()" style="background:#ff4d4d; border:none; color:white; padding:5px 10px; margin-left:10px; cursor:pointer; border-radius:4px; font-weight:bold;">Logout</button>
        `;
    }
}

function showCustomAlert(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `<span style="font-weight: 500;">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast && document.body.contains(toast)) {
            toast.style.animation = 'fadeOutRight 0.4s forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
}

window.logout = function() {
    if (maintenanceCheckInterval) {
        clearInterval(maintenanceCheckInterval);
    }
    auth.signOut().then(() => {
        window.location.href = 'admin_login.html';
    });
};

window.adminResetAuctions = async function() {
    if (!confirm("CRITICAL: Wipe ALL active auctions?")) return;
    try {
        const snap = await db.collection("products").get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showCustomAlert("All active auctions cleared.", "success");
    } catch (e) {
        showCustomAlert(e.message, "error");
    }
};

window.adminResetHistory = async function() {
    if (!confirm("CRITICAL: Clear ALL transaction history?")) return;
    try {
        const snap = await db.collection("history").get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showCustomAlert("Transaction history cleared.", "success");
    } catch (e) {
        showCustomAlert(e.message, "error");
    }
};

async function loadMaintenanceStatus() {
    const statusDiv = document.getElementById('maintenanceStatus');
    if (!statusDiv) return;

    try {
        const statusDoc = await db.collection("system").doc("status").get();
        const now = new Date().getTime();
        
        if (statusDoc.exists) {
            const data = statusDoc.data();
            const isActive = data.maintenance || false;
            const endTime = data.maintenanceEndTime ? data.maintenanceEndTime.toMillis() : null;
            
            let statusHtml = '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">';
            statusHtml += `<span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>`;
            statusHtml += '<span style="color: #ccc;">Current Maintenance Status</span>';
            statusHtml += '</div>';
            
            if (isActive && endTime) {
                const timeLeft = Math.max(0, endTime - now);
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                    
                    statusHtml += '<div style="margin-top: 10px;">';
                    statusHtml += '<span style="color: #888;">Time remaining: </span>';
                    statusHtml += `<span class="countdown-timer" id="maintenanceCountdown">${hours}h ${minutes}m ${seconds}s</span>`;
                    statusHtml += '</div>';
                    
                    if (data.maintenanceReason) {
                        statusHtml += `<p style="color: #888; font-size: 0.8rem; margin-top: 5px;">Reason: ${data.maintenanceReason}</p>`;
                    }
                } else {
                    await db.collection("system").doc("status").update({
                        maintenance: false,
                        maintenanceEndTime: firebase.firestore.FieldValue.delete()
                    });
                    loadMaintenanceStatus();
                }
            }
            
            statusDiv.innerHTML = statusHtml;
        } else {
            statusDiv.innerHTML = '<p style="color: #888;">No maintenance status found.</p>';
        }
    } catch (error) {
        console.error('Error loading maintenance status:', error);
        statusDiv.innerHTML = '<p style="color: #ff4d4d;">Error loading status</p>';
    }
}

function startMaintenanceStatusUpdates() {
    if (maintenanceCheckInterval) {
        clearInterval(maintenanceCheckInterval);
    }
    
    maintenanceCheckInterval = setInterval(() => {
        updateMaintenanceCountdown();
    }, 1000);
}

async function updateMaintenanceCountdown() {
    const countdownEl = document.getElementById('maintenanceCountdown');
    if (!countdownEl) return;

    try {
        const statusDoc = await db.collection("system").doc("status").get();
        if (!statusDoc.exists) return;

        const data = statusDoc.data();
        if (!data.maintenance || !data.maintenanceEndTime) return;

        const now = new Date().getTime();
        const endTime = data.maintenanceEndTime.toMillis();
        const timeLeft = Math.max(0, endTime - now);

        if (timeLeft <= 0) {
            await db.collection("system").doc("status").update({
                maintenance: false,
                maintenanceEndTime: firebase.firestore.FieldValue.delete()
            });
            loadMaintenanceStatus();
            showCustomAlert('Maintenance mode automatically disabled - timer expired', 'warning');
            return;
        }

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        countdownEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
    } catch (error) {
        console.error('Error updating countdown:', error);
    }
}

window.toggleMaintenance = async function() {
    try {
        const statusRef = db.collection("system").doc("status");
        const doc = await statusRef.get();
        const currentState = doc.exists ? doc.data().maintenance : false;
        
        if (currentState) {
            await statusRef.update({
                maintenance: false,
                maintenanceEndTime: firebase.firestore.FieldValue.delete(),
                maintenanceReason: firebase.firestore.FieldValue.delete()
            });
            showCustomAlert('Maintenance mode DISABLED', 'warning');
        } else {
            await statusRef.set({
                maintenance: true,
                maintenanceStartTime: firebase.firestore.FieldValue.serverTimestamp(),
                maintenanceReason: 'Manual activation'
            }, { merge: true });
            showCustomAlert('Maintenance mode ENABLED (no timer)', 'warning');
        }
        
        loadMaintenanceStatus();
    } catch (error) {
        console.error('Error toggling maintenance:', error);
        showCustomAlert('Error toggling maintenance: ' + error.message, 'error');
    }
};

window.startMaintenanceWithTimer = async function() {
    const hours = parseInt(document.getElementById('maintHours').value) || 0;
    const minutes = parseInt(document.getElementById('maintMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('maintSeconds').value) || 0;
    
    const totalMilliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000);
    
    if (totalMilliseconds <= 0) {
        showCustomAlert('Please set a valid duration (greater than 0)', 'error');
        return;
    }

    if (totalMilliseconds > 72 * 60 * 60 * 1000) {
        showCustomAlert('Maximum maintenance duration is 72 hours', 'error');
        return;
    }

    try {
        const statusRef = db.collection("system").doc("status");
        const now = new Date();
        const endTime = new Date(now.getTime() + totalMilliseconds);
        
        await statusRef.set({
            maintenance: true,
            maintenanceStartTime: firebase.firestore.FieldValue.serverTimestamp(),
            maintenanceEndTime: firebase.firestore.Timestamp.fromDate(endTime),
            maintenanceDuration: totalMilliseconds,
            maintenanceReason: `Scheduled for ${hours}h ${minutes}m ${seconds}s`
        }, { merge: true });

        const timeString = `${hours}h ${minutes}m ${seconds}s`;
        showCustomAlert(`Maintenance mode ENABLED for ${timeString}`, 'warning');
        
        document.getElementById('maintHours').value = '0';
        document.getElementById('maintMinutes').value = '0';
        document.getElementById('maintSeconds').value = '0';
        
        loadMaintenanceStatus();
    } catch (error) {
        console.error('Error starting maintenance with timer:', error);
        showCustomAlert('Error starting maintenance: ' + error.message, 'error');
    }
};

window.addEventListener('beforeunload', function() {
    if (maintenanceCheckInterval) {
        clearInterval(maintenanceCheckInterval);
    }
});