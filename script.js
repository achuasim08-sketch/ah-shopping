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

const ADMIN_EMAIL = 'admin@gmail.com';

const usernameCache = new Map();

async function getUsernameByUid(uid) {
    if (usernameCache.has(uid)) {
        return usernameCache.get(uid);
    }
    
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const username = userData.username || userData.email.split('@')[0];
            usernameCache.set(uid, username);
            return username;
        }
    } catch (error) {
        console.error('Error fetching username:', error);
    }
    return null;
}

async function getUsernameByEmail(email) {
    try {
        const usersSnapshot = await db.collection('users').where('email', '==', email).get();
        if (!usersSnapshot.empty) {
            const userData = usersSnapshot.docs[0].data();
            return userData.username || email.split('@')[0];
        }
    } catch (error) {
        console.error('Error fetching username by email:', error);
    }
    return email.split('@')[0];
}

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
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const user = auth.currentUser;
    if (user) {
        db.collection('users').doc(user.uid).update({
            rulesSeen: true
        }).catch(err => console.error("Error updating rulesSeen:", err));
    }
    localStorage.setItem('rulesSeen', 'true');
};

async function checkAndShowRules() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.rulesSeen === false) {
                const modal = document.getElementById('rulesModal');
                if (modal) {
                    modal.style.display = 'flex';
                }
            }
        } else {
            const modal = document.getElementById('rulesModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error("Error checking rulesSeen:", error);
    }
}

function initializePageLogic() {
    const path = window.location.pathname;
    applyMaintenanceUI();
    
    if (path.includes("index.html") || path.endsWith("/")) {
        renderProducts();
        setupSearch();
        checkAuctionAvailability();
        checkAndShowRules();
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
        const username = await getUsernameByUid(user.uid);
        const displayName = username || user.email.split('@')[0];
        
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
            <span style="color:#2addef; font-weight:bold;">${displayName}</span>
        `;
    } catch (e) {
        const username = await getUsernameByUid(user.uid);
        const displayName = username || user.email.split('@')[0];
        profile.innerHTML = `<span style="color:#2addef; font-weight:bold;">${displayName}</span>`;
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
        
        if (auth.currentUser.uid !== product.sellerUid) {
            throw new Error("You are not authorized to cancel this auction.");
        }

        await productRef.update({
            status: 'cancelled',
            deleted: true
        });

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
            
            if (endTime > now && p.status === 'active' && !p.deleted) active = true;
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

            if (endTime < now || p.deleted || p.status === 'cancelled') return; 
            
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

async function checkRegistrationFee(productId, userId) {
    try {
        const registrationRef = db.collection("registrations").doc(`${productId}_${userId}`);
        const registrationDoc = await registrationRef.get();
        
        if (registrationDoc.exists) {
            return {
                paid: true,
                data: registrationDoc.data()
            };
        } else {
            return {
                paid: false
            };
        }
    } catch (error) {
        console.error("Error checking registration fee:", error);
        return {
            paid: false,
            error: error.message
        };
    }
}

window.payRegistrationFee = async function(productId) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const productDoc = await db.collection("products").doc(productId).get();
        if (!productDoc.exists) {
            showCustomAlert("Product not found!", "error");
            return;
        }
        
        const product = productDoc.data();
        
        if (window.EasyPayIO) {
            EasyPayIO.pay({
                amount: FEES.REGISTRATION,
                productName: `Registration Fee - ${product.name}`,
                productDescription: `Auction registration fee for ${product.name}`,
                userEmail: user.email,
                onSuccess: async (response) => {
                    console.log('Registration payment successful:', response);
                    
                    const registrationRef = db.collection("registrations").doc(`${productId}_${user.uid}`);
                    await registrationRef.set({
                        productId: productId,
                        productName: product.name,
                        userId: user.uid,
                        userEmail: user.email,
                        sellerUid: product.sellerUid,
                        sellerEmail: product.sellerEmail,
                        feeAmount: FEES.REGISTRATION,
                        paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'paid',
                        transactionId: response.transactionId || 'txn_' + Date.now()
                    });
                    
                    showCustomAlert("Registration fee paid successfully! You can now place your bid.", "success");
                    
                    location.reload();
                },
                onFailure: (error) => {
                    console.error('Registration payment failed:', error);
                    showCustomAlert('Registration fee payment failed. Please try again.', 'error');
                }
            });
        } else {
            showCustomAlert('Payment system not available. Please try again.', 'error');
        }
    } catch (error) {
        console.error("Error processing registration fee:", error);
        showCustomAlert("Error processing registration fee: " + error.message, "error");
    }
};

function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id'); 
    
    db.collection("products").doc(productId).onSnapshot(async (doc) => {
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
            const action = isAdmin ? `adminDeleteProduct('${doc.id}')` : `cancelAuction('${doc.id}')`;
            area.innerHTML = `<button onclick="${action}" class="submit-btn" style="background: #ff4d4d;">${label}</button>`;
        } else {
            const currentBid = parseInt(product.price);
            
            let highestBidderHtml = '';
            if (product.highestBidder) {
                const bidderUsername = await getUsernameByEmail(product.highestBidder);
                highestBidderHtml = `
                    <div style="background: rgba(42, 221, 241, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #2addef;">
                        <p style="margin: 0; color: #2addef;">🏆 Current Highest Bidder</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 1.1rem;">${bidderUsername}</p>
                        <p style="margin: 5px 0 0 0; color: #00ff00;">₹${product.price}</p>
                    </div>
                `;
            } else {
                highestBidderHtml = `
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <p style="margin: 0; color: #888;">No bids yet. Be the first to bid!</p>
                    </div>
                `;
            }
            
            const registrationStatus = await checkRegistrationFee(productId, user.uid);
            
            if (!registrationStatus.paid) {
                area.innerHTML = `
                    ${highestBidderHtml}
                    <div style="background: rgba(255, 215, 0, 0.1); padding: 20px; border-radius: 8px; border: 2px solid #ffd700; text-align: center;">
                        <h3 style="color: #ffd700; margin-top: 0;">🔒 Registration Required</h3>
                        <p style="margin: 15px 0;">To bid on this item, you need to pay a one-time registration fee of <span style="color: #ffd700; font-weight: bold; font-size: 1.3rem;">₹${FEES.REGISTRATION}</span></p>
                        <p style="font-size: 0.9rem; color: #ccc; margin-bottom: 20px;">This fee allows you to bid on this specific auction only.</p>
                        <button onclick="payRegistrationFee('${productId}')" class="easypayio-pay-btn submit-btn" style="background: #ffd700; color: #111; border: none; font-weight: bold;">
                            Pay ₹${FEES.REGISTRATION} Registration Fee with EasyPayIO 💳
                        </button>
                    </div>
                `;
            } else {
                area.innerHTML = `
                    ${highestBidderHtml}
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                        <div style="background: rgba(0, 255, 0, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 15px; border-left: 3px solid #00ff00;">
                            <p style="margin: 0; color: #00ff00;">✅ Registration fee paid</p>
                        </div>
                        <p>Current Bid: <span style="color: #2addef; font-weight: bold;">₹${currentBid}</span></p>
                        <p style="font-size: 0.9rem; color: #ccc;">Enter amount to add to current bid</p>
                        <div style="display:flex; flex-direction: column; gap:10px;">
                            <input type="number" id="customBidAmount" placeholder="Enter amount to add (e.g., 10, 50, 100)" style="flex:1; padding:12px; border-radius:8px; border:1px solid #2addef; background:transparent; color:white;" min="1" step="1" value="0">
                            <div style="display:flex; gap:10px; align-items: center;">
                                <span style="color:#fff;">Your total bid =</span>
                                <span id="totalBidDisplay" style="color:#00ff00; font-weight:bold; font-size:1.2rem;">₹${currentBid}</span>
                            </div>
                            <button onclick="placeBid('${productId}')" class="bid-btn">Place Bid of ₹${currentBid}</button>
                        </div>
                    </div>
                `;
                
                document.getElementById('customBidAmount').addEventListener('input', function() {
                    const addAmount = parseInt(this.value) || 0;
                    const total = currentBid + addAmount;
                    document.getElementById('totalBidDisplay').innerText = `₹${total}`;
                    document.querySelector('#actionArea .bid-btn').innerText = `Place Bid of ₹${total}`;
                });
            }
        }
        
        startTimer('detailTimer', endTime);
    });
}

window.placeBid = async function(productId) {
    const user = auth.currentUser; 
    const addAmount = parseInt(document.getElementById('customBidAmount').value) || 0;
    const ref = db.collection("products").doc(productId);
    let totalBidAmount = 0;
    
    try {
        const registrationStatus = await checkRegistrationFee(productId, user.uid);
        
        if (!registrationStatus.paid) {
            showCustomAlert("You must pay the registration fee before placing a bid!", "error");
            return;
        }
        
        const username = await getUsernameByUid(user.uid);
        
        await db.runTransaction(async (t) => {
            const d = await t.get(ref); 
            const p = d.data(); 
            const currentBid = p.price;
            totalBidAmount = currentBid + addAmount;
            
            if (user.uid === p.sellerUid) throw new Error("Owners cannot bid!");
            if (addAmount < 1) throw new Error("Please enter a valid amount to add");
            
            t.update(ref, { 
                price: totalBidAmount, 
                highestBidder: user.email,
                highestBidderUsername: username,
                highestBidderUid: user.uid 
            });
        });
        
        document.getElementById('customBidAmount').value = '0';
        showCustomAlert(`Your bid of ₹${totalBidAmount} has been recorded!`, "success");
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
                    sellerEmail: auth.currentUser.email,
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

async function loadTransactionHistory() {
    const grid = document.getElementById('historyGrid'); 
    if (!grid) return;
    
    db.collection("history").orderBy("soldAt", "desc").onSnapshot(async (snap) => {
        grid.innerHTML = "";
        
        for (const doc of snap.docs) {
            const h = doc.data(); 
            const winnerUsername = await getUsernameByEmail(h.highestBidder);
            
            const card = document.createElement('div'); 
            card.className = 'form-card'; 
            card.style.marginBottom = "20px";
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="text-align:left;">
                    <h2>${h.name}</h2>
                    <p>Winner: <b>${winnerUsername}</b></p>
                </div>
                <div style="text-align:right;">
                    <span class="price-tag">₹${h.price}</span>
                </div>
            </div>`;
            grid.appendChild(card);
        }
    });
}

async function loadLeaderboard() {
    const grid = document.getElementById('leaderboardGrid'); 
    if (!grid) return;
    
    try {
        const historySnapshot = await db.collection("history").get();
        const stats = {};
        
        historySnapshot.forEach(doc => { 
            const h = doc.data(); 
            stats[h.highestBidder] = (stats[h.highestBidder] || 0) + 1; 
        });
        
        const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]);
        
        let leaderboardHtml = '';
        for (let i = 0; i < sorted.length; i++) {
            const [email, wins] = sorted[i];
            const username = await getUsernameByEmail(email);
            leaderboardHtml += `
                <div class="form-card" style="margin-bottom:10px; display:flex; justify-content:space-between;">
                    <span>#${i+1} <b>${username}</b></span>
                    <span style="color:#2addef;">${wins} Win${wins > 1 ? 's' : ''}</span>
                </div>
            `;
        }
        
        grid.innerHTML = leaderboardHtml || '<p class="empty-msg">No winners yet. Be the first!</p>';
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        grid.innerHTML = '<p class="empty-msg">Error loading leaderboard</p>';
    }
}

function setupSignup() { 
    document.getElementById('signupForm')?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        
        const email = document.getElementById('su-email').value;
        const username = document.getElementById('su-username').value.toLowerCase().trim();
        const pass = document.getElementById('su-pass').value;
        const phone = document.getElementById('su-phone').value;
        const address = document.getElementById('su-address').value;

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            showCustomAlert('Username must be 3-30 characters and can only contain letters, numbers, and underscores', 'error');
            return;
        }

        try {
            const usernameSnapshot = await db.collection('usernames').doc(username).get();
            if (usernameSnapshot.exists) {
                showCustomAlert('Username already taken. Please choose another one.', 'error');
                return;
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;
            
            await db.collection('usernames').doc(username).set({
                uid: user.uid,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await db.collection('users').doc(user.uid).set({
                email: email,
                username: username,
                phone: phone,
                address: address,
                rulesSeen: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showCustomAlert("Account created successfully!", "success");
            
        } catch (error) {
            showCustomAlert(error.message, "error");
        }
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

async function checkAuctionCompletion() {
    const now = new Date().getTime();
    const productsRef = db.collection("products");
    
    try {
        const snapshot = await productsRef.where("status", "==", "active").get();
        
        snapshot.forEach(async (doc) => {
            const auction = doc.data();
            const startTime = auction.createdAt ? auction.createdAt.toMillis() : now;
            const endTime = startTime + (auction.durationMs || 10800000);
            
            if (endTime < now && !auction.deleted) {
                const auctionRef = productsRef.doc(doc.id);
                
                if (auction.highestBidderUid) {
                    const winnerUsername = await getUsernameByUid(auction.highestBidderUid);
                    
                    await db.collection("history").add({
                        name: auction.name,
                        price: auction.price,
                        highestBidder: auction.highestBidder,
                        highestBidderUsername: winnerUsername || auction.highestBidder.split('@')[0],
                        highestBidderUid: auction.highestBidderUid,
                        sellerUid: auction.sellerUid,
                        sellerEmail: auction.sellerEmail,
                        soldAt: firebase.firestore.FieldValue.serverTimestamp(),
                        image: auction.image,
                        transactionId: auction.transactionId || null
                    });
                    
                    await auctionRef.update({
                        status: 'ended',
                        endedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    const currentUser = auth.currentUser;
                    if (currentUser && currentUser.uid === auction.highestBidderUid) {
                        showCustomAlert('🎉 Congratulations! You won the auction! Proceed to checkout.', 'success');
                        
                        setTimeout(() => {
                            window.location.href = `checkout.html?id=${doc.id}`;
                        }, 3000);
                    }
                } else {
                    await auctionRef.update({
                        status: 'ended',
                        deleted: true,
                        endedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error checking auction completion:', error);
    }
}

setInterval(checkAuctionCompletion, 10000);
document.addEventListener('DOMContentLoaded', checkAuctionCompletion);