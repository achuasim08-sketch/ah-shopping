// --- SECTION 1: DISPLAY & FILTER LOGIC ---
// This function handles rendering the "Dynamic Product Listings" with search/filter
function renderProducts(filterText = "", filterCategory = "all") {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    grid.innerHTML = ""; // Clear current view
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];

    // Apply Search and Category Filters
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(filterText.toLowerCase());
        const matchesCategory = filterCategory === "all" || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1; text-align: center; padding: 50px;">No products found matching your search.</p>';
        return;
    }

    filtered.forEach(p => addProductToGrid(p));
}

// Function to create each product card with the new CSS-compatible structure
function addProductToGrid(product) {
    const grid = document.getElementById('productGrid');
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.id = `card-${product.id}`;

    // SECURITY CHECK: Identify if the current user is the owner
    let myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
    const isOwner = myUploads.includes(product.id);

    // Updated HTML structure to match your combined style.css
    productCard.innerHTML = `
        <div class="image-wrapper">
            <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="product-details">
            <h3>${product.name}</h3>
            <p class="price-tag">Current Bid: ₹<span id="price-${product.id}">${product.price}</span></p>
            <p class="timer" id="timer-${product.id}">Calculating...</p>
        </div>
        <div class="button-group">
            ${!isOwner ? 
                `<button onclick="placeBid(${product.id})" class="bid-btn">Place Bid (+₹500)</button>` : 
                `<p style="color: #232f3e; font-weight: bold; background: #eee; padding: 10px; border-radius: 4px; text-align:center;">You are the seller</p>`
            }
            
            ${isOwner ? 
                `<button onclick="removeListing(${product.id})" class="delete-btn">Cancel Auction</button>` : 
                ''
            }
        </div>
    `;
    grid.appendChild(productCard);
    startTimer(product.id, product.endTime);
}

// --- SECTION 2: BIDDING LOGIC (INR ₹) ---
function placeBid(productId) {
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const index = products.findIndex(p => p.id === productId);

    if (index !== -1) {
        // Increment the value in Indian Rupees
        products[index].price = parseInt(products[index].price) + 500;
        localStorage.setItem('ah_products', JSON.stringify(products));

        // Update the UI instantly
        const priceSpan = document.getElementById(`price-${productId}`);
        if(priceSpan) priceSpan.innerText = products[index].price;
        
        alert(`Bid placed successfully! Current price: ₹${products[index].price}`);
    }
}

// --- SECTION 3: SELLER TOOLS ---
function removeListing(productId) {
    if (confirm("Are you sure you want to remove this listing? This action cannot be undone.")) {
        // Remove from global list
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('ah_products', JSON.stringify(products));

        // Remove from owner list
        let myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
        myUploads = myUploads.filter(id => id !== productId);
        localStorage.setItem('ah_my_uploads', JSON.stringify(myUploads));

        renderProducts(); // Refresh the grid
    }
}

// --- SECTION 4: REAL-TIME TIMER ---
function startTimer(id, endTime) {
    const timerElement = document.getElementById(`timer-${id}`);
    if (!timerElement) return;

    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;

        if (distance < 0) {
            clearInterval(interval);
            timerElement.innerHTML = "AUCTION CLOSED";
            timerElement.style.color = "red";
            return;
        }

        const h = Math.floor((distance % 86400000) / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        
        timerElement.innerHTML = `Ends in: ${h}h ${m}m ${s}s`;
    }, 1000);
}

// --- SECTION 5: UPLOAD LOGIC ---
document.getElementById('uploadForm')?.addEventListener('submit', function(e) {
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
            image: reader.result,
            endTime: new Date().getTime() + (3 * 3600000) // Default: 3-hour auction
        };

        // Save to Global List
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products.push(newProduct);
        localStorage.setItem('ah_products', JSON.stringify(products));

        // Save to Owner List
        let myUploads = JSON.parse(localStorage.getItem('ah_my_uploads')) || [];
        myUploads.push(productId);
        localStorage.setItem('ah_my_uploads', JSON.stringify(myUploads));

        alert("Auction Launched Successfully!");
        window.location.href = 'index.html';
    };

    reader.readAsDataURL(imageInput.files[0]);
});

// --- SECTION 6: INITIALIZATION ---
window.onload = function() {
    renderProducts();
    
    // Setup Search Logic
    const searchBtn = document.querySelector('.search-container button');
    const searchInput = document.getElementById('searchBar');
    const categorySelect = document.getElementById('filterCategory');

    if (searchBtn) {
        searchBtn.onclick = () => {
            renderProducts(searchInput.value, categorySelect.value);
        };
    }

    // Optional: Allow pressing "Enter" in search bar to trigger search
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });
};