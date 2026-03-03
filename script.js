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


auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

const FEES = {
    REGISTRATION: 500,
    BID_INCREMENT: 500
};

const ADMIN_EMAIL = 'admin@ahshopping.com';

auth.onAuthStateChanged((user) => {
    const path = window.location.pathname;
    const isPublicPage = path.includes('login.html') || path.includes('signup.html');
    
    if (!user && !isPublicPage) { 
        window.location.href = 'login.html'; 
        return; 
    } else if (user && isPublicPage) { 
        window.location.href = 'index.html'; 
        return; 
    }
    
    if (user) { 
        setupUserProfile(user); 
        if (path.includes("index.html") || path.endsWith("/")) {
            checkFirstVisit();
        }
    }
    initializePageLogic();
});

function checkFirstVisit() {
    if (!localStorage.getItem('rulesSeen')) {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
}

window.closeRules = function() {
    localStorage.setItem('rulesSeen', 'true');
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

function initializePageLogic() {
    const path = window.location.pathname;
    applyMaintenanceUI();
    
    if (path.includes("index.html") || path.endsWith("/")) {
        renderProducts();
        setupSearch();
        checkAuctionAvailability();
    } else if (path.includes("product.html")) {
        loadProductDetails();
    } else if (path.includes("upload.html")) {
        setupUploadPage();
    } else if (path.includes("history.html")) {
        loadTransactionHistory();
    } else if (path.includes("leaderboard.html")) {
        loadLeaderboard();
    } else if (path.includes("login.html")) {
        setupLogin(); 
    } else if (path.includes("signup.html")) {
        setupSignup(); 
    }
}

async function applyMaintenanceUI() {
    try {
        const statusDoc = await db.collection("system").doc("status").get();
        if (statusDoc.exists && statusDoc.data().maintenance) {
            document.body.classList.add('maintenance-active');
        } else {
            document.body.classList.remove('maintenance-active');
        }
    } catch (e) { 
        console.error(e); 
    }
}

async function setupUserProfile(user) {
    const profile = document.querySelector('.user-profile');
    if (!profile || window.location.pathname.includes('checkout.html')) return;
    
    try {
        const snapshot = await db.collection("history").get();
        const stats = {};
        snapshot.forEach(doc => {
            const h = doc.data();
            stats[h.highestBidder] = (stats[h.highestBidder] || 0) + 1;
        });
        const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]);
        const isChampion = sorted.length > 0 && sorted[0][0] === user.email;
        
        profile.innerHTML = `
            ${isChampion ? '<span title="Top Winner" style="margin-right:8px; filter: drop-shadow(0 0 8px #ffd700); cursor:help;">👑</span>' : ''}
            <span style="color:#2addef; font-weight:bold;">${user.email.split('@')[0]}</span> 
            <button onclick="logout()" style="background:#ff4d4d; border:none; color:white; padding:5px 10px; margin-left:10px; cursor:pointer; border-radius:4px; font-weight:bold;">Logout</button>
        `;
    } catch (e) {
        profile.innerHTML = `<span style="color:#2addef; font-weight:bold;">${user.email.split('@')[0]}</span> <button onclick="logout()" style="background:#ff4d4d; border:none; color:white; padding:5px 10px; margin-left:10px; cursor:pointer; border-radius:4px; font-weight:bold;">Logout</button>`;
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

function startTimer(elementId, endTime) {
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        
        if (distance < 0) { 
            clearInterval(interval); 
            timerElement.innerHTML = "Auction Closed"; 
            timerElement.style.color = "#ff4d4d"; 
            return; 
        }
        
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerElement.innerHTML = `⏳ ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

window.logout = function() {
    auth.signOut().then(() => { 
        window.location.href = 'login.html'; 
    });
};

window.toggleMaintenance = async function() {
    if (auth.currentUser.email !== ADMIN_EMAIL) return;
    
    const statusRef = db.collection("system").doc("status");
    const doc = await statusRef.get();
    const currentState = doc.exists ? doc.data().maintenance : false;
    
    await statusRef.set({ maintenance: !currentState }, { merge: true });
    showCustomAlert(`Maintenance: ${!currentState ? 'ENABLED' : 'DISABLED'}`, "warning");
    applyMaintenanceUI();
};

window.cancelAuction = async function(id) {
    try {
        if (!confirm("Are you sure you want to cancel this auction? This action cannot be undone!")) return;

        const productRef = db.collection("products").doc(id);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            showCustomAlert("Product not found!", "error");
            window.location.href = "index.html";
            return;
        }

        const product = productDoc.data();
        console.log("Current user UID:", auth.currentUser?.uid);
        console.log("Seller UID from document:", product.sellerUid);

        await productRef.delete();
        showCustomAlert("Auction cancelled successfully!", "success");
        window.location.href = "index.html";
    } catch (e) {
        console.error("Error cancelling auction:", e);
        showCustomAlert("Error cancelling auction: " + e.message, "error");
    }
};

window.adminDeleteProduct = async function(id) {
    try {
        if (!confirm("CRITICAL: Delete this auction as admin?")) {
            return;
        }
        
        await db.collection("products").doc(id).delete();
        showCustomAlert("Product deleted by admin!", "success");
        window.location.href = "index.html";
    } catch (e) { 
        console.error("Error deleting product:", e);
        showCustomAlert(e.message, "error"); 
    }
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

async function checkAuctionAvailability() {
    const sellBtn = document.querySelector("button[onclick*='upload.html']");
    if (!sellBtn) return;
    
    try {
        const statusDoc = await db.collection("system").doc("status").get();
        if (statusDoc.exists && statusDoc.data().maintenance) {
            sellBtn.style.opacity = "0.5"; 
            sellBtn.style.cursor = "not-allowed"; 
            sellBtn.innerText = "Locked";
            sellBtn.onclick = (e) => { 
                e.preventDefault(); 
                showCustomAlert("System maintenance in progress.", "warning"); 
            };
            return;
        }
        
        const now = new Date().getTime();
        const snapshot = await db.collection("products").get();
        let active = false;
        
        snapshot.forEach(doc => {
            const p = doc.data();
            const startTime = p.createdAt ? p.createdAt.toMillis() : now;
            const endTime = startTime + (p.durationMs || 10800000);
            if (endTime > now) active = true;
        });
        
        if (active) {
            sellBtn.style.opacity = "0.5"; 
            sellBtn.style.cursor = "not-allowed"; 
            sellBtn.innerText = "Auction Busy";
            sellBtn.onclick = (e) => { 
                e.preventDefault(); 
                showCustomAlert("Only one auction allowed platform-wide!", "warning"); 
            };
        }
    } catch (e) { 
        console.error(e); 
    }
}

function renderProducts(filterText = "", filterCategory = "all") {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    db.collection("products").onSnapshot((snapshot) => {
        grid.innerHTML = "";
        const now = new Date().getTime();
        let activeCount = 0;
        
        snapshot.forEach((doc) => {
            const p = doc.data();
            const id = doc.id;
            const startTime = p.createdAt ? p.createdAt.toMillis() : now;
            const endTime = startTime + (p.durationMs || 10800000); 
            
            if (endTime < now) return; 
            
            const nameMatch = p.name.toLowerCase().includes(filterText.toLowerCase());
            const catMatch = filterCategory === "all" || p.category.toLowerCase() === filterCategory.toLowerCase();
            
            if (nameMatch && catMatch) {
                activeCount++;
                const isOwner = auth.currentUser && p.sellerUid === auth.currentUser.uid;
                const card = document.createElement('div');
                card.className = 'product-card';
                card.onclick = () => window.location.href = `product.html?id=${id}`;
                card.innerHTML = `<div class="image-wrapper">${isOwner ? '<span style="position:absolute; top:10px; left:10px; background:#2addef; color:#111; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:10;">YOUR ITEM</span>' : ''}<img src="${p.image}"></div><div class="product-details"><h3>${p.name}</h3><p class="price-tag">₹${p.price}</p><p class="timer" id="timer-${id}">Loading...</p><button class="bid-btn" style="width:100%;">${isOwner ? 'Manage Auction' : 'View Auction'}</button></div>`;
                grid.appendChild(card);
                startTimer(`timer-${id}`, endTime);
            }
        });
        
        if (activeCount === 0) {
            grid.innerHTML = `<p class="empty-msg">No active auctions found.</p>`;
        }
    });
}

function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id'); 
    
    if (!productId) { 
        window.location.href = 'index.html'; 
        return; 
    }
    
    db.collection("products").doc(productId).onSnapshot((doc) => {
        if (!doc.exists) { 
            window.location.href = 'index.html'; 
            return; 
        }
        
        const product = doc.data(); 
        const user = auth.currentUser; 
        const now = new Date().getTime();
        const startTime = product.createdAt ? product.createdAt.toMillis() : now;
        const endTime = startTime + (product.durationMs || 10800000);
        const isActive = (endTime + 2000) > now;
        
        document.getElementById('detailImage').src = product.image;
        document.getElementById('detailName').innerText = product.name;
        document.getElementById('detailDesc').innerText = product.description || "No description provided.";
        document.getElementById('detailPrice').innerText = product.price;
        
        const area = document.getElementById('actionArea');
        const isAdmin = user && user.email === ADMIN_EMAIL;
        
        if (!isActive) {
            if (user && product.highestBidderUid === user.uid) {
                area.innerHTML = `<div class="status-box owner" style="color:#00ff00;">🎉 WINNER! ₹${product.price}</div><button class="submit-btn" onclick="window.location.href='checkout.html?id=${doc.id}'">Proceed to Checkout</button>`;
            } else { 
                area.innerHTML = `<div class="status-box closed">Auction Closed. Final: ₹${product.price}</div>`; 
            }
            document.getElementById('detailTimer').innerHTML = "Closed"; 
            return;
        }
        
        if (user && (user.uid === product.sellerUid || isAdmin)) {
            const label = isAdmin ? "Admin: Force Delete" : "Cancel Auction";
            area.innerHTML = `<button onclick="cancelAuction('${doc.id}')" class="submit-btn" style="background: #ff4d4d;">${label}</button>`;
        } else {
            const min = parseInt(product.price) + FEES.BID_INCREMENT;
            area.innerHTML = `<div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;"><p>Next Bid: ₹${min}</p><div style="display:flex; gap:10px;"><input type="number" id="customBidAmount" placeholder="₹${min}" style="flex:1; padding:10px; border-radius:8px; border:1px solid #2addef; background:transparent; color:white;"><button onclick="placeBid('${doc.id}')" class="bid-btn">Place Bid</button></div></div>`;
        }
        
        startTimer('detailTimer', endTime);
    });
}

window.placeBid = async function(productId) {
    const user = auth.currentUser; 
    const bidAmt = parseInt(document.getElementById('customBidAmount').value);
    const ref = db.collection("products").doc(productId);
    
    try {
        await db.runTransaction(async (t) => {
            const d = await t.get(ref); 
            const p = d.data(); 
            const min = p.price + FEES.BID_INCREMENT;
            
            if (user.uid === p.sellerUid) throw new Error("Owners cannot bid!");
            if (isNaN(bidAmt) || bidAmt < min) throw new Error(`Min bid is ₹${min}`);
            
            t.update(ref, { 
                price: bidAmt, 
                highestBidder: user.email, 
                highestBidderUid: user.uid 
            });
        });
        showCustomAlert("Your bid has been recorded!", "success");
    } catch (e) { 
        showCustomAlert(e.message, "error"); 
    }
};

function setupUploadPage() {
    document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stat = await db.collection("system").doc("status").get();
        if (stat.exists && stat.data().maintenance) { 
            showCustomAlert("Maintenance active.", "warning"); 
            return; 
        }
        
        const file = document.getElementById('prodImage').files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height, max = 600;
                
                if (w > h && w > max) { 
                    h *= max/w; 
                    w = max; 
                } else if (h > max) { 
                    w *= max/h; 
                    h = max; 
                }
                
                canvas.width = w; 
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                
                db.collection("products").add({
                    name: document.getElementById('prodName').value,
                    price: parseInt(document.getElementById('prodPrice').value),
                    category: document.getElementById('prodCategory').value,
                    description: document.getElementById('prodDesc').value || "",
                    image: canvas.toDataURL('image/jpeg', 0.7),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    durationMs: 10800000,
                    sellerUid: auth.currentUser.uid,
                    highestBidder: null, 
                    highestBidderUid: null
                }).then(() => { 
                    showCustomAlert("Auction LIVE!", "success"); 
                    window.location.href="index.html"; 
                });
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function loadTransactionHistory() {
    const grid = document.getElementById('historyGrid'); 
    if (!grid) return;
    
    db.collection("history").orderBy("soldAt", "desc").onSnapshot((snap) => {
        grid.innerHTML = "";
        snap.forEach((doc) => {
            const h = doc.data(); 
            const card = document.createElement('div'); 
            card.className = 'form-card'; 
            card.style.marginBottom = "20px";
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><h2>${h.name}</h2><p>Winner: <b>${h.highestBidder}</b></p></div><div style="text-align:right;"><span class="price-tag">₹${h.price}</span></div></div>`;
            grid.appendChild(card);
        });
    });
}

function loadLeaderboard() {
    const grid = document.getElementById('leaderboardGrid'); 
    if (!grid) return;
    
    db.collection("history").get().then((snap) => {
        const stats = {}; 
        snap.forEach(doc => { 
            const h = doc.data(); 
            stats[h.highestBidder] = (stats[h.highestBidder] || 0) + 1; 
        });
        
        const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]);
        grid.innerHTML = sorted.map(([u, w], i) => `<div class="form-card" style="margin-bottom:10px; display:flex; justify-content:space-between;"><span>#${i+1} <b>${u}</b></span><span style="color:#2addef;">${w} Wins</span></div>`).join('');
    });
}

function setupSignup() { 
    document.getElementById('signupForm')?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        auth.createUserWithEmailAndPassword(document.getElementById('su-email').value, document.getElementById('su-pass').value)
        .then(() => showCustomAlert("Success!", "success")); 
    }); 
}

function setupLogin() { 
    document.getElementById('loginForm')?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        auth.signInWithEmailAndPassword(document.getElementById('li-email').value, document.getElementById('li-pass').value)
        .then(() => showCustomAlert("Welcome!", "success")); 
    }); 
}

function setupSearch() { 
    document.querySelector('.search-container button')?.addEventListener('click', () => {
        renderProducts(document.getElementById('searchBar').value, document.getElementById('filterCategory').value);
    }); 
}