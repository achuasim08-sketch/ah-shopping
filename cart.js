document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        loadCartItems(user);
    });
});

async function loadCartItems(user) {
    const container = document.getElementById('cartItems');
    try {
        const snapshot = await db.collection('pending_payments')
            .where('userId', '==', user.uid)
            .where('paid', '==', false)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="empty-msg">Your cart is empty. Won items will appear here.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const date = item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'Just now';
            html += `
                <div class="cart-item">
                    <div>
                        <h3>${item.auctionName}</h3>
                        <p class="price">₹${item.amount}</p>
                        <p style="color: #888;">Won on: ${date}</p>
                    </div>
                    <button class="pay-now" onclick="payNow('${item.productId}')">Pay Now</button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading cart:', error);
        container.innerHTML = '<p class="empty-msg">Error loading cart. Please try again.</p>';
    }
}

window.payNow = function(productId) {
    window.location.href = `checkout.html?id=${productId}`;
};