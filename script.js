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

const FEES = {
    REGISTRATION: 500,
    BID_INCREMENT: 500
};

auth.onAuthStateChanged((user) => {
    const path = window.location.pathname;
    const isPublicPage = path.includes('login.html') || path.includes('signup.html');
    if (!user && !isPublicPage) { window.location.href = 'login.html'; return; } 
    else if (user && isPublicPage) { window.location.href = 'index.html'; return; }
    if (user) { 
        setupUserProfile(user); 
        if (path.includes("index.html") || path.endsWith("/")) checkFirstVisit();
    }
    initializePageLogic();
});

function checkFirstVisit() {
    if (!localStorage.getItem('rulesShown')) {
        const modal = document.getElementById('rulesModal');
        if (modal) modal.style.display = 'flex';
    }
}

function closeRules() {
    const modal = document.getElementById('rulesModal');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('rulesShown', 'true');
}

function initializePageLogic() {
    const path = window.location.pathname;
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
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `<span style="font-weight: 500;">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => { if (document.body.contains(toast)) { toast.style.animation = 'fadeOutRight 0.4s forwards'; setTimeout(() => toast.remove(), 400); } }, 4000);
}

function startTimer(elementId, endTime) {
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        if (distance < 0) { clearInterval(interval); timerElement.innerHTML = "Auction Closed"; timerElement.style.color = "#ff4d4d"; return; }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerElement.innerHTML = `⏳ ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

async function checkAuctionAvailability() {
    const sellBtn = document.querySelector("button[onclick*='upload.html']");
    if (!sellBtn) return;
    try {
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
            sellBtn.style.opacity = "0.5"; sellBtn.style.cursor = "not-allowed"; sellBtn.innerText = "Auction Busy";
            sellBtn.onclick = (e) => { e.preventDefault(); showCustomAlert("Only one auction allowed!", "warning"); };
        }
    } catch (e) { console.error(e); }
}

function setupUploadPage() {
    document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const now = new Date().getTime();
            const snapshot = await db.collection("products").get();
            let activeExists = false;
            snapshot.forEach(doc => {
                const p = doc.data();
                const startTime = p.createdAt ? p.createdAt.toMillis() : now;
                const endTime = startTime + (p.durationMs || 10800000);
                if (endTime > now) activeExists = true;
            });
            if (activeExists) { showCustomAlert("Wait for current auction to end!", "warning"); return; }
        } catch (err) { return; }
        const file = document.getElementById('prodImage').files[0];
        if (!file) { showCustomAlert("Select image.", "warning"); return; }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                const MAX_SIZE = 600; 
                if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedImage = canvas.toDataURL('image/jpeg', 0.7);
                const newProduct = {
                    name: document.getElementById('prodName').value,
                    price: parseInt(document.getElementById('prodPrice').value),
                    category: document.getElementById('prodCategory').value,
                    description: document.getElementById('prodDesc').value || "",
                    image: compressedImage, 
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    durationMs: 3 * 3600000, 
                    sellerUid: auth.currentUser.uid,
                    highestBidder: null, highestBidderUid: null
                };
                db.collection("products").add(newProduct).then(() => {
                    showCustomAlert("Auction Launched! 🚀", "success");
                    setTimeout(() => window.location.href = "index.html", 1500);
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function recordToHistory(productId, productData) {
    try {
        const historyRef = db.collection("history").doc(productId);
        const doc = await historyRef.get();
        if (!doc.exists && productData.highestBidderUid) {
            await historyRef.set({ ...productData, soldAt: firebase.firestore.FieldValue.serverTimestamp(), status: "sold" });
            
            await db.collection("mail").add({
                to: productData.highestBidder,
                message: {
                    subject: `🏆 You Won the Auction: ${productData.name}!`,
                    text: `Congratulations! You won the auction for ${productData.name} with a bid of ₹${productData.price}. Visit AH SHOPPING to complete your purchase.`,
                }
            });
        }
    } catch (e) { console.error(e); }
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
            if (endTime < now) { if (p.highestBidderUid) recordToHistory(id, p); return; } 
            if (p.name.toLowerCase().includes(filterText.toLowerCase()) && (filterCategory === "all" || p.category.toLowerCase() === filterCategory.toLowerCase())) {
                activeCount++;
                const card = document.createElement('div');
                card.className = 'product-card';
                card.onclick = () => window.location.href = `product.html?id=${id}`;
                card.innerHTML = `<div class="image-wrapper"><img src="${p.image}"></div><div class="product-details"><h3>${p.name}</h3><p class="price-tag">₹${p.price}</p><p class="timer" id="timer-${id}">Calculating...</p><button class="bid-btn" style="width:100%;">View Auction</button></div>`;
                grid.appendChild(card);
                startTimer(`timer-${id}`, endTime);
            }
        });
        if (activeCount === 0) grid.innerHTML = `<p class="empty-msg">No active auctions found.</p>`;
    });
}

function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id'); 
    if (!productId) { window.location.href = 'index.html'; return; }
    const productRef = db.collection("products").doc(productId);
    productRef.onSnapshot((doc) => {
        if (!doc.exists) { window.location.href = 'index.html'; return; }
        const product = doc.data(); const currentUser = auth.currentUser; const now = new Date().getTime();
        const startTime = product.createdAt ? product.createdAt.toMillis() : now;
        const endTime = startTime + (product.durationMs || 10800000);
        const isActive = (endTime + 2000) > now;
        document.getElementById('detailImage').src = product.image;
        document.getElementById('detailName').innerText = product.name;
        document.getElementById('detailDesc').innerText = product.description || "No description.";
        document.getElementById('detailPrice').innerText = product.price;
        const actionArea = document.getElementById('actionArea');
        if (!isActive) {
            if (currentUser && product.highestBidderUid === currentUser.uid) {
                actionArea.innerHTML = `<div class="status-box owner" style="color:#00ff00;">🎉 You won! ₹${product.price}</div><button class="submit-btn" onclick="window.location.href='checkout.html?id=${doc.id}'">Checkout</button>`;
            } else { actionArea.innerHTML = `<div class="status-box closed">Closed. Winner Bid: ₹${product.price}</div>`; }
            document.getElementById('detailTimer').innerHTML = "Closed"; return;
        }
        if (currentUser && currentUser.uid === product.sellerUid) {
            actionArea.innerHTML = `<button onclick="cancelAuction('${doc.id}')" class="submit-btn" style="background: #ff4d4d;">Cancel Auction</button>`;
        } else {
            const minBid = parseInt(product.price) + FEES.BID_INCREMENT;
            actionArea.innerHTML = `<div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;"><p>Min bid: ₹${minBid}</p><div style="display:flex; gap:10px;"><input type="number" id="customBidAmount" placeholder="₹${minBid}" style="flex:1; padding:10px; border-radius:8px; border:1px solid #2addef; background:transparent; color:white;"><button onclick="placeBid('${doc.id}')" class="bid-btn">Bid Now</button></div></div>`;
        }
        startTimer('detailTimer', endTime);
    });
}

function loadTransactionHistory() {
    const grid = document.getElementById('historyGrid'); if (!grid) return;
    db.collection("history").orderBy("soldAt", "desc").onSnapshot((snapshot) => {
        grid.innerHTML = "";
        snapshot.forEach((doc) => {
            const h = doc.data(); const card = document.createElement('div'); card.className = 'form-card'; card.id = `receipt-${doc.id}`; card.style.marginBottom = "20px";
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><h2>${h.name}</h2><p>Winner: <b>${h.highestBidder}</b></p></div><div style="text-align:right;"><span class="price-tag">₹${h.price}</span><br><button onclick="downloadReceipt('receipt-${doc.id}', '${h.name}')" style="margin-top:10px; background:#00ff00; color:#000; padding:5px 10px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">PDF Receipt</button></div></div>`;
            grid.appendChild(card);
        });
    });
}

function loadLeaderboard() {
    const grid = document.getElementById('leaderboardGrid'); if (!grid) return;
    db.collection("history").get().then((snapshot) => {
        const stats = {}; snapshot.forEach(doc => { const h = doc.data(); stats[h.highestBidder] = (stats[h.highestBidder] || 0) + 1; });
        const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]);
        grid.innerHTML = sorted.map(([user, wins], i) => `<div class="form-card" style="margin-bottom:10px; display:flex; justify-content:space-between;"><span>#${i+1} <b>${user}</b></span><span style="color:#2addef;">${wins} Wins</span></div>`).join('');
    });
}

function adminResetAuctions() {
    if(confirm("Delete all active auctions?")) {
        db.collection("products").get().then(snap => snap.forEach(doc => doc.ref.delete()));
        showCustomAlert("System Reset Successful", "success");
    }
}

function adminResetHistory() {
    if(confirm("Wipe all history?")) {
        db.collection("history").get().then(snap => snap.forEach(doc => doc.ref.delete()));
        showCustomAlert("History Wiped", "success");
    }
}

function downloadReceipt(elementId, itemName) {
    const element = document.getElementById(elementId);
    const opt = { margin: 1, filename: `${itemName}_Receipt.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#111' }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    if (typeof html2pdf !== 'undefined') html2pdf().from(element).set(opt).save();
}

async function placeBid(productId) {
    const user = auth.currentUser; const bidAmount = parseInt(document.getElementById('customBidAmount').value); const productRef = db.collection("products").doc(productId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(productRef); const p = doc.data(); const minBid = p.price + FEES.BID_INCREMENT;
            if (user.uid === p.sellerUid) throw "Own item!"; if (isNaN(bidAmount) || bidAmount < minBid) throw `Min bid ₹${minBid}`;
            transaction.update(productRef, { price: bidAmount, highestBidder: user.email, highestBidderUid: user.uid });
        });
        showCustomAlert(`Bid placed!`, "success");
    } catch (e) { showCustomAlert(e, "error"); }
}

function setupSignup() { document.getElementById('signupForm')?.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('su-email').value; const pass = document.getElementById('su-pass').value; auth.createUserWithEmailAndPassword(email, pass).then(() => showCustomAlert("Account created!", "success")); }); }
function setupLogin() { document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('li-email').value; const pass = document.getElementById('li-pass').value; auth.signInWithEmailAndPassword(email, pass).then(() => showCustomAlert("Logged in!", "success")); }); }
function logout() { auth.signOut().then(() => { window.location.href = 'login.html'; }); }
function cancelAuction(id) { if(confirm("Cancel?")) db.collection("products").doc(id).delete(); }
function setupSearch() {
    const searchBtn = document.querySelector('.search-container button');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            renderProducts(document.getElementById('searchBar').value, document.getElementById('filterCategory').value);
        });
    }
}