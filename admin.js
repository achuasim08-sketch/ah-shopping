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

// Ensure session persistence for admin (tab‑isolated)
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(console.error);

const ADMIN_EMAIL = 'admin@gmail.com';

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'admin_login.html';
        return;
    }
    
    if (user.email !== ADMIN_EMAIL) {
        alert('Access denied. You are not authorized to view this page.');
        auth.signOut();
        window.location.href = 'admin_login.html';
        return;
    }
    
    setupAdminProfile(user);
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

window.toggleMaintenance = async function() {
    const statusRef = db.collection("system").doc("status");
    const doc = await statusRef.get();
    const currentState = doc.exists ? doc.data().maintenance : false;
    
    await statusRef.set({ maintenance: !currentState }, { merge: true });
    showCustomAlert(`Maintenance: ${!currentState ? 'ENABLED' : 'DISABLED'}`, "warning");
};