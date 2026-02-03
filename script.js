function addProductToGrid(product) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const emptyMsg = document.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.id = `card-${product.id}`;
    productCard.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="price-tag">Current Bid: ₹<span id="price-${product.id}">${product.price}</span></p>
        <p class="timer" id="timer-${product.id}">Calculating time...</p>
        <div class="button-group">
            <button onclick="placeBid(${product.id})" class="bid-btn">Place Bid (+₹500)</button>
            <button onclick="removeListing(${product.id})" class="delete-btn">Cancel Auction</button>
        </div>
    `;
    grid.appendChild(productCard);
    startTimer(product.id, product.endTime);
}
function placeBid(productId) {
    let products = JSON.parse(localStorage.getItem('ah_products')) || [];
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
        products[index].price = parseInt(products[index].price) + 500;
        localStorage.setItem('ah_products', JSON.stringify(products));
        document.getElementById(`price-${productId}`).innerText = products[index].price;
        console.log(`New bid of ₹${products[index].price} placed.`);
    }
}
function removeListing(productId) {
    if (confirm("Are you sure you want to remove this listing?")) {
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('ah_products', JSON.stringify(products));
        const card = document.getElementById(`card-${productId}`);
        if (card) card.remove();
        alert("Listing removed successfully.");
    }
}
function startTimer(id, endTime) {
    const timerElement = document.getElementById(`timer-${id}`);
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerElement.innerHTML = `Ends in: ${hours}h ${minutes}m ${seconds}s`;
        if (distance < 0) {
            clearInterval(interval);
            timerElement.innerHTML = "AUCTION CLOSED";
            timerElement.style.color = "red";
        }
    }, 1000);
}
document.getElementById('uploadForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const imageFile = document.getElementById('prodImage').files[0];
    const reader = new FileReader();
    reader.onloadend = function() {
        const newProduct = {
            id: Date.now(),
            name: document.getElementById('prodName').value,
            price: document.getElementById('prodPrice').value,
            category: document.getElementById('prodCategory').value,
            image: reader.result, 
            endTime: new Date().getTime() + (3 * 60 * 60 * 1000) // 3-hour auction
        };
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products.push(newProduct);
        localStorage.setItem('ah_products', JSON.stringify(products));
        window.location.href = 'index.html'; 
    };
    if (imageFile) reader.readAsDataURL(imageFile);
});
window.onload = function() {
    const grid = document.getElementById('productGrid');
    if (grid) {
        let products = JSON.parse(localStorage.getItem('ah_products')) || [];
        products.forEach(p => addProductToGrid(p));
    }
};