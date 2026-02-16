const FEES = {
    REGISTRATION: 500,
    BID_INCREMENT: 500
};
window.onload = function() {
    const path = window.location.pathname;
    if (path.includes("product.html")) {
        loadProductDetails();
    } else if (path.includes("upload.html")) {
        setupUploadPage();
    } else {
        renderProducts();
        setupSearch();
    }
};
function renderProducts(filterText = "", filterCategory = "all") {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    grid.innerHTML = ""; 
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(filterText.toLowerCase());
        const matchesCategory = filterCategory === "all" || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1; text-align: center; padding: 50px;">No active auctions. Be the first to upload!</p>';
        return;
    }
    filtered.sort((a, b) => b.endTime - a.endTime);
    filtered.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.onclick = () => window.location.href = `product.html?id=${product.id}`;
        productCard.style.cursor = "pointer";
        const isActive = product.endTime > new Date().getTime();
        productCard.innerHTML = `
            <div class="image-wrapper">
                <img src="${product.image}" alt="${product.name}" style="${!isActive ? 'filter: grayscale(100%);' : ''}">
            </div>
            <div class="product-details">
                <h3>${product.name} ${!isActive ? '(SOLD)' : ''}</h3>
                <p class="price-tag">₹${product.price}</p>
                <p class="timer" id="timer-idx-${product.id}">${isActive ? 'Calculating...' : 'Auction Ended'}</p>
                <button class="bid-btn" style="width:100%; margin-top:10px;">
                    ${isActive ? 'View Auction' : 'View Results'}
                </button>
            </div>
        `;
        grid.appendChild(productCard);
        if(isActive) {
            startTimer(`timer-idx-${product.id}`, product.endTime);
        } else {
            const t = document.getElementById(`timer-idx-${product.id}`);
            if(t) { t.innerHTML = "AUCTION CLOSED"; t.style.borderColor = "grey"; t.style.color = "grey"; }
        }
    });
}
function setupSearch() {
    const searchBtn = document.querySelector('.search-container button');
    const searchInput = document.getElementById('searchBar');
    const categorySelect = document.getElementById('filterCategory');
    if (searchBtn && searchInput) {
        searchBtn.onclick = () => renderProducts(searchInput.value, categorySelect.value);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchBtn.click();
        });
    }
}
function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    const products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const product = products.find(p => p.id === productId);
    if (!product) {
        document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:50px;'>Product Not Found</h1><div style='text-align:center'><a href='index.html' style='color:#2addef'>Return Home</a></div>";
        return;
    }
    document.getElementById('detailImage').src = product.image;
    document.getElementById('detailName').innerText = product.name;
    document.getElementById('detailDesc').innerText = product.description || "No description provided.";
    document.getElementById('detailPrice').innerText = product.price;
    const isActive = product.endTime > new Date().getTime();
    if (isActive) {
        startTimer('detailTimer', product.endTime);
    } else {
        const dt = document.getElementById('detailTimer');
        dt.innerText = "AUCTION CLOSED";
        dt.style.borderColor = "grey";
        dt.style.color = "grey";
    }
    const actionArea = document.getElementById('actionArea');
    const myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
    const isOwner = myUploads.includes(productId);
    const joinedAuctions = JSON.parse(localStorage.getItem('ah_joined_auctions')) || [];
    const hasJoined = joinedAuctions.includes(productId);
    actionArea.innerHTML = "";
    if (!isActive) {
        actionArea.innerHTML = `<div class="status-box closed">This auction has ended. Final Price: ₹${product.price}</div>`;
        return;
    }
    if (isOwner) {
        actionArea.innerHTML = `
            <div class="status-box owner">You are the seller of this item.</div>
            <button onclick="removeListing(${product.id})" class="delete-btn" style="width:100%; margin-top:10px; background:#ff4d4d; color:white; border:none; padding:10px; cursor:pointer;">Cancel Auction</button>
        `;
    } else if (hasJoined) {
        const nextBid = parseInt(product.price) + FEES.BID_INCREMENT;
        actionArea.innerHTML = `
            <div class="bid-controls">
                <p style="color: #2addef; font-size: 0.9rem; margin-bottom: 5px;">✅ You are a registered bidder</p>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button onclick="placeBid(${product.id})" class="bid-btn" style="flex-grow:1; cursor:pointer;">
                        Place Bid (₹${nextBid})
                    </button>
                </div>
                <p style="color: gray; font-size: 0.8rem; margin-top: 5px;">Min Increment: ₹${FEES.BID_INCREMENT}</p>
            </div>
        `;
    } else {
        actionArea.innerHTML = `
            <div class="join-gate" style="text-align:center; background: rgba(255,174,0,0.1); padding:20px; border-radius:10px; border:1px solid rgba(255,174,0,0.5);">
                <p style="color:#ffae00; margin-bottom:10px;">🔒 Locked Auction</p>
                <p style="font-size:0.9rem; margin-bottom:15px;">To place a bid on this item, you must pay a refundable registration fee.</p>
                <button onclick="joinAuction(${product.id})" class="submit-btn" style="background: #ffae00; color: #000; width:100%;">
                    Pay ₹${FEES.REGISTRATION} to Join
                </button>
                <p style="font-size:0.7rem; color:#888; margin-top:10px;">Secure Payment Gateway</p>
            </div>
        `;
    }
}
function joinAuction(productId) {
    if(confirm(`Confirm payment of ₹${FEES.REGISTRATION} to join this auction?`)) {
        let joined = JSON.parse(localStorage.getItem('ah_joined_auctions')) || [];
        joined.push(productId);
        localStorage.setItem('ah_joined_auctions', JSON.stringify(joined));
        alert("Payment Successful! You can now place bids.");
        location.reload();
    }
}
function placeBid(productId) {
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
        if (products[index].endTime < new Date().getTime()) {
            alert("Auction just ended!");
            location.reload();
            return;
        }
        products[index].price = parseInt(products[index].price) + FEES.BID_INCREMENT;
        localStorage.setItem('ah_products', JSON.stringify(products));
        alert(`Bid Placed! New Price: ₹${products[index].price}`);
        location.reload();
    }
}
function removeListing(productId) {
    if (confirm("Are you sure you want to cancel this auction? This cannot be undone.")) {
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('ah_products', JSON.stringify(products));
        let myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
        myUploads = myUploads.filter(id => id !== productId);
        localStorage.setItem('ah_my_uploads', JSON.stringify(myUploads));
        alert("Auction Cancelled.");
        window.location.href = 'index.html';
    }
}
function setupUploadPage() {
    const uploadForm = document.getElementById('uploadForm');
    if (!uploadForm) return;
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const now = new Date().getTime();
    const activeAuction = products.find(p => p.endTime > now);
    if (activeAuction) {
        const inputs = uploadForm.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => input.disabled = true);
        const warning = document.createElement('div');
        warning.style.cssText = "background: #ff4d4d; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; border: 2px solid white;";
        warning.innerHTML = `⚠️ SYSTEM LOCKED<br>An auction is currently active. You cannot list new items until it ends.`;
        uploadForm.prepend(warning);
        return;
    }
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const imageInput = document.getElementById('prodImage');
        if (!imageInput.files[0]) {
            alert("Please upload an image.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = function() {
            const productId = Date.now();
            const newProduct = {
                id: productId,
                name: document.getElementById('prodName').value,
                price: document.getElementById('prodPrice').value,
                category: document.getElementById('prodCategory').value,
                description: document.getElementById('prodDesc').value, // Capture description
                image: reader.result,
                endTime: new Date().getTime() + (3 * 3600000) // Default 3 hours
            };
            products.push(newProduct);
            localStorage.setItem('ah_products', JSON.stringify(products));
            let myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
            myUploads.push(productId);
            localStorage.setItem('ah_my_uploads', JSON.stringify(myUploads));
            alert("Auction Launched Successfully!");
            window.location.href = 'index.html';
        };
        reader.readAsDataURL(imageInput.files[0]);
    });
}

function startTimer(elementId, endTime) {
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;
    if(timerElement.dataset.interval) clearInterval(timerElement.dataset.interval);
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        if (distance < 0) {
            clearInterval(interval);
            timerElement.innerHTML = "AUCTION CLOSED";
            timerElement.style.color = "grey";
            if(window.location.pathname.includes("product.html") && !timerElement.dataset.reloaded) {
                timerElement.dataset.reloaded = "true";
                location.reload();
            }
            return;
        }
        const h = Math.floor((distance % 86400000) / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        timerElement.innerHTML = `Ends in: ${h}h ${m}m ${s}s`;
    }, 1000);
    timerElement.dataset.interval = interval;
}