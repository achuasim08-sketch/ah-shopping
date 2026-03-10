const checkoutSummary = document.getElementById('checkoutSummary');
const checkoutForm = document.getElementById('checkoutForm');
const payNowBtn = document.getElementById('payNowBtn');
const paymentLoading = document.getElementById('paymentLoading');

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

let currentAuction = null;
let userData = null;

async function loadCheckoutData() {
    if (!productId) {
        showError('No product specified');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const auctionDoc = await db.collection("products").doc(productId).get();
        if (!auctionDoc.exists) {
            showError('Auction not found');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        const auction = auctionDoc.data();
        const now = new Date().getTime();
        const startTime = auction.createdAt ? auction.createdAt.toMillis() : now;
        const endTime = startTime + (auction.durationMs || 10800000);

        if (auction.highestBidderUid !== user.uid) {
            showError('You are not the winner of this auction');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        if (endTime > now) {
            showError('Auction is still active');
            setTimeout(() => window.location.href = `product.html?id=${productId}`, 2000);
            return;
        }

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
        }

        currentAuction = auction;
        displayOrderSummary(auction, userData);
        setupPaymentButton(auction, user);

    } catch (error) {
        console.error('Error loading checkout data:', error);
        showError('Failed to load checkout data');
    }
}

function displayOrderSummary(auction, userData) {
    const total = auction.price;
    const tax = Math.round(total * 0.18);
    const grandTotal = total + tax;

    checkoutSummary.innerHTML = `
        <div style="border-bottom: 1px solid rgba(42,221,241,0.2); padding-bottom: 10px; margin-bottom: 10px;">
            <h3 style="color: #2addef; margin: 0 0 10px 0;">${auction.name}</h3>
            <p style="color: #ccc; font-size: 0.9rem;">${auction.description || 'No description provided'}</p>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
            <span>Winning Bid:</span>
            <span class="price-tag" style="font-size: 1.2rem;">₹${auction.price}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0;">
            <span>GST (18%):</span>
            <span class="price-tag" style="font-size: 1.2rem;">₹${tax}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 15px 0 0 0; padding-top: 10px; border-top: 2px solid #2addef;">
            <span style="font-weight: bold;">Total Amount:</span>
            <span class="price-tag" style="font-size: 1.8rem;">₹${grandTotal}</span>
        </div>
        <div style="margin-top: 15px; color: #888; font-size: 0.8rem; text-align: center;">
            <p>🔒 Secure payment powered by EasyPayIO</p>
        </div>
    `;

    if (userData) {
        document.getElementById('fullName').value = userData.fullName || '';
        document.getElementById('shippingAddress').value = userData.address || '';
    }
}

function setupPaymentButton(auction, user) {
    const total = auction.price + Math.round(auction.price * 0.18);
    
    payNowBtn.setAttribute('data-amount', total);
    payNowBtn.setAttribute('data-product-name', auction.name);
    payNowBtn.setAttribute('data-product-description', auction.description || `Winning bid: ₹${auction.price}`);
    payNowBtn.setAttribute('data-user-email', user.email);

    const newPayNowBtn = payNowBtn.cloneNode(true);
    payNowBtn.parentNode.replaceChild(newPayNowBtn, payNowBtn);
    
    newPayNowBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!validateShippingForm()) {
            return;
        }

        paymentLoading.style.display = 'flex';

        if (window.EasyPayIO) {
            EasyPayIO.pay({
                amount: total,
                productName: auction.name,
                productDescription: auction.description || `Winning bid: ₹${auction.price}`,
                userEmail: user.email,
                onSuccess: (response) => {
                    console.log('Payment successful:', response);
                    handlePaymentSuccess({
                        ...response,
                        amount: total,
                        transactionId: response.transactionId || 'txn_' + Date.now()
                    });
                },
                onFailure: (error) => {
                    console.error('Payment failed:', error);
                    handlePaymentFailure(error);
                }
            });
        } else {
            paymentLoading.style.display = 'none';
            showCustomAlert('Payment system not available. Please try again.', 'error');
        }
    });
}

function validateShippingForm() {
    const fullName = document.getElementById('fullName').value.trim();
    const address = document.getElementById('shippingAddress').value.trim();
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const expiryDate = document.getElementById('expiryDate').value.trim();
    const cvv = document.getElementById('cvv').value.trim();

    if (!fullName) {
        showCustomAlert('Please enter your full name', 'error');
        return false;
    }

    if (!address) {
        showCustomAlert('Please enter your shipping address', 'error');
        return false;
    }

    if (!/^\d{16}$/.test(cardNumber)) {
        showCustomAlert('Please enter a valid 16-digit card number', 'error');
        return false;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
        showCustomAlert('Please enter a valid expiry date (MM/YY)', 'error');
        return false;
    }

    if (!/^\d{3}$/.test(cvv)) {
        showCustomAlert('Please enter a valid 3-digit CVV', 'error');
        return false;
    }

    return true;
}

async function handlePaymentSuccess(response) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not logged in');

        const fullName = document.getElementById('fullName').value.trim();
        const address = document.getElementById('shippingAddress').value.trim();

        const orderData = {
            auctionId: productId,
            productName: currentAuction.name,
            productImage: currentAuction.image,
            winningBid: currentAuction.price,
            totalAmount: response.amount,
            transactionId: response.transactionId,
            paymentGateway: 'EasyPayIO',
            paymentStatus: 'completed',
            paymentTime: firebase.firestore.FieldValue.serverTimestamp(),
            customerUid: user.uid,
            customerEmail: user.email,
            customerName: fullName,
            shippingAddress: address,
            sellerUid: currentAuction.sellerUid,
            sellerEmail: currentAuction.sellerEmail,
            orderDate: firebase.firestore.FieldValue.serverTimestamp(),
            orderStatus: 'paid'
        };

        await db.collection("orders").add(orderData);

        await db.collection("history").add({
            name: currentAuction.name,
            price: currentAuction.price,
            highestBidder: user.email,
            highestBidderUid: user.uid,
            sellerUid: currentAuction.sellerUid,
            sellerEmail: currentAuction.sellerEmail,
            soldAt: firebase.firestore.FieldValue.serverTimestamp(),
            transactionId: response.transactionId,
            orderId: response.orderId
        });

        await db.collection("products").doc(productId).update({
            status: 'sold',
            deleted: true,
            soldTo: user.email,
            soldAt: firebase.firestore.FieldValue.serverTimestamp(),
            transactionId: response.transactionId
        });

        paymentLoading.style.display = 'none';

        showCustomAlert('Payment successful! Redirecting to history...', 'success');

        setTimeout(() => {
            window.location.href = 'history.html';
        }, 2000);

    } catch (error) {
        console.error('Error processing payment:', error);
        paymentLoading.style.display = 'none';
        showCustomAlert('Payment successful but failed to update order. Please contact support.', 'error');
    }
}

function handlePaymentFailure(error) {
    paymentLoading.style.display = 'none';
    
    let message = 'Payment failed. Please try again.';
    if (error.code === 'USER_CANCELLED') {
        message = 'Payment was cancelled.';
    } else if (error.code === 'POPUP_BLOCKED') {
        message = 'Please allow popups for this site to process payments.';
    }
    
    showCustomAlert(message, 'error');
    console.error('Payment failed:', error);
}

function showError(message) {
    checkoutSummary.innerHTML = `
        <div style="text-align: center; color: #ff4d4d; padding: 20px;">
            <h3>Error</h3>
            <p>${message}</p>
            <p>Redirecting to home page...</p>
        </div>
    `;
}

window.addEventListener('easypayio:payment:success', (event) => {
    console.log('Payment success event received:', event.detail);
    handlePaymentSuccess(event.detail);
});

window.addEventListener('easypayio:payment:cancelled', (event) => {
    console.log('Payment cancelled:', event.detail);
    handlePaymentFailure({ code: 'USER_CANCELLED' });
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        loadCheckoutData();
    } else {
        console.error('Firebase not loaded');
        showError('System error. Please try again.');
    }
});

document.getElementById('cardNumber')?.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.replace(/(\d{4})(?=\d)/g, '$1-');
    e.target.value = formatted;
});

document.getElementById('expiryDate')?.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    e.target.value = value;
});

document.getElementById('cvv')?.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3);
    e.target.value = value;
});

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