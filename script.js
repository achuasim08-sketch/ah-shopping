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
    if (!user && !isPublicPage) {
        window.location.href = 'login.html';
        return;
    } 
    else if (user && isPublicPage) {
        window.location.href = 'index.html';
        return;
    }
    if (user) {
        setupUserProfile(user);
    }
    initializePageLogic();
});
function initializePageLogic() {
    const path = window.location.pathname;
    if (path.includes("index.html") || path.endsWith("/")) {
        renderProducts();
        setupSearch();
    } else if (path.includes("product.html")) {
        loadProductDetails();
    } else if (path.includes("upload.html")) {
        setupUploadPage();
    } else if (path.includes("login.html")) {
        setupLogin(); 
    } else if (path.includes("signup.html")) {
        setupSignup(); 
    } else if (path.includes("checkout.html")) {
    }
}
function setupUserProfile(user) {
    const profile = document.querySelector('.user-profile');
    if (profile && !window.location.pathname.includes('checkout.html')) {
        profile.innerHTML = `
            <span style="color:#2addef; font-weight:bold;">${user.email.split('@')[0]}</span> 
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
    toast.innerHTML = `
        <span style="font-weight: 500;">${msg}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.style.animation = 'fadeOutRight 0.4s forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
}
function startTimer(elementId, endTime, productName) {
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now
        if (distance < 0) {
            clearInterval(interval);
            timerElement.innerHTML = "Auction Closed";
            timerElement.style.color = "#ff4d4d";
            timerElement.style.borderColor = "#ff4d4d";
            return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerElement.innerHTML = `⏳ ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}
function setupSignup() {
    document.getElementById('signupForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('su-email').value;
        const pass = document.getElementById('su-pass').value;
        auth.createUserWithEmailAndPassword(email, pass)
            .then(() => showCustomAlert("Account created successfully!", "success"))
            .catch(err => showCustomAlert(err.message, "error"));
    });
}
function setupLogin() {
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('li-email').value;
        const pass = document.getElementById('li-pass').value;   
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => showCustomAlert("Logged in safely!", "success"))
            .catch(() => showCustomAlert("Invalid email or password", "error"));
    });
}
function logout() {
    auth.signOut().then(() => { window.location.href = 'login.html'; });
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
            if (p.endTime < now) return; 
            const matchesSearch = p.name.toLowerCase().includes(filterText.toLowerCase());
            const matchesCategory = filterCategory === "all" || p.category.toLowerCase() === filterCategory.toLowerCase();
            if (matchesSearch && matchesCategory) {
                activeCount++;
                const card = document.createElement('div');
                card.className = 'product-card';
                card.onclick = () => window.location.href = `product.html?id=${id}`;
                card.innerHTML = `
                    <div class="image-wrapper"><img src="${p.image}" alt="${p.name}"></div>
                    <div class="product-details">
                        <h3 style="margin-top:0;">${p.name}</h3>
                        <p class="price-tag">₹${p.price}</p>
                        <p class="timer" id="timer-${id}">Calculating...</p>
                        <button class="bid-btn" style="width:100%;">View Auction</button>
                    </div>`;
                grid.appendChild(card);
                startTimer(`timer-${id}`, p.endTime, p.name);
            }
        });
        if (activeCount === 0) {
            grid.innerHTML = `<p class="empty-msg">No active auctions found. Be the first to upload a product!</p>`;
        }
    });
}
function setupSearch() {
    const searchBar = document.getElementById('searchBar');
    const filterCategory = document.getElementById('filterCategory');
    const searchBtn = document.querySelector('.search-container button');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            renderProducts(searchBar.value, filterCategory.value);
        });
    }
}
function setupUploadPage() {
    document.getElementById('uploadForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const file = document.getElementById('prodImage').files[0];
        if (!file) {
            showCustomAlert("Please select an image.", "warning");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const newProduct = {
                name: document.getElementById('prodName').value,
                price: parseInt(document.getElementById('prodPrice').value),
                category: document.getElementById('prodCategory').value,
                description: document.getElementById('prodDesc').value || "",
                image: reader.result, // Base64
                endTime: new Date().getTime() + (3 * 3600000), // 3 hours
                sellerUid: auth.currentUser.uid,
                highestBidder: null,
                highestBidderUid: null
            };
            db.collection("products").add(newProduct)
                .then(() => {
                    showCustomAlert("Auction Launched Successfully! 🚀", "success");
                    setTimeout(() => window.location.href = "index.html", 1500);
                })
                .catch(err => showCustomAlert("Error uploading: " + err.message, "error"));
        };
        reader.readAsDataURL(file);
    });
}
function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id'); 
    if (!productId) {
        window.location.href = 'index.html';
        return;
    }
    const productRef = db.collection("products").doc(productId);
    productRef.onSnapshot((doc) => {
        if (!doc.exists) {
            showCustomAlert("Product no longer exists.", "error");
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }
        const product = doc.data();
        const currentUser = auth.currentUser;
        document.getElementById('detailImage').src = product.image;
        document.getElementById('detailName').innerText = product.name;
        document.getElementById('detailDesc').innerText = product.description || "No description provided.";
        document.getElementById('detailPrice').innerText = product.price;
        const isActive = product.endTime > new Date().getTime();
        const actionArea = document.getElementById('actionArea');
        if (!isActive) {
            if (currentUser && product.highestBidderUid === currentUser.uid) {
                actionArea.innerHTML = `
                    <div class="status-box owner" style="color:#00ff00; border-color:#00ff00;">
                        🎉 You won this auction! Final Price: ₹${product.price}
                    </div>
                    <button class="submit-btn" onclick="window.location.href='checkout.html?id=${doc.id}'" style="margin-top:15px;">Proceed to Checkout</button>
                `;
            } else {
                actionArea.innerHTML = `<div class="status-box closed">Auction Closed. Winning Bid: ₹${product.price}</div>`;
            }
            document.getElementById('detailTimer').innerHTML = "Closed";
            return;
        }
        const minBid = parseInt(product.price) + FEES.BID_INCREMENT;
        actionArea.innerHTML = `
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin-top: 0; font-size: 0.9rem; color: #ccc;">Minimum next bid: ₹${minBid}</p>
                <div style="display: flex; gap: 10px;">
                    <input type="number" id="customBidAmount" placeholder="₹${minBid}" min="${minBid}" 
                        style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #2addef; background: rgba(255,255,255,0.05); color: white; outline: none;">
                    <button onclick="placeBid('${doc.id}')" class="bid-btn" style="padding: 12px 25px;">Bid Now</button>
                </div>
            </div>`;
        startTimer('detailTimer', product.endTime, product.name);
    });
}
async function placeBid(productId) {
    const user = auth.currentUser;
    if (!user) {
        showCustomAlert("Please log in to place a bid.", "warning");
        return;
    }
    const bidInput = document.getElementById('customBidAmount');
    const bidAmount = parseInt(bidInput.value);
    const productRef = db.collection("products").doc(productId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(productRef);
            if (!doc.exists) throw "Product does not exist!";
            const p = doc.data();
            const minBid = p.price + FEES.BID_INCREMENT;
            if (user.uid === p.sellerUid) throw "You cannot bid on your own item!";
            if (isNaN(bidAmount) || bidAmount < minBid) throw `Minimum valid bid is ₹${minBid}`;
            transaction.update(productRef, {
                price: bidAmount,
                highestBidder: user.email,
                highestBidderUid: user.uid
            });
        });
        showCustomAlert(`Bid of ₹${bidAmount} placed successfully!`, "success");
        bidInput.value = "";
    } catch (error) {
        showCustomAlert(error, "error");
    }
}
function showCart() {
    showCustomAlert("Redirecting to your Won Items...", "info");
}

function showMyUploads() {
    showCustomAlert("Redirecting to your Uploads...", "info");
}