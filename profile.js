document.addEventListener('DOMContentLoaded', () => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            loadUserProfile(user);
            loadActiveBids(user);
            loadWonAuctions(user);
            unsubscribe();
        }
    });
});

async function loadUserProfile(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            document.getElementById('profileUsername').value = data.username || '';
            document.getElementById('profileEmail').value = user.email;
            document.getElementById('profilePhone').value = data.phone || '';
            document.getElementById('profileAddress').value = data.address || '';
        } else {
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                username: user.email.split('@')[0],
                phone: '',
                address: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadUserProfile(user);
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showCustomAlert('Failed to load profile', 'error');
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const username = document.getElementById('profileUsername').value.trim().toLowerCase();
    const phone = document.getElementById('profilePhone').value.trim();
    const address = document.getElementById('profileAddress').value.trim();

    try {
        const usernameSnapshot = await db.collection('usernames').doc(username).get();
        if (usernameSnapshot.exists) {
            const existing = usernameSnapshot.data();
            if (existing.uid !== user.uid) {
                showCustomAlert('Username already taken. Please choose another.', 'error');
                return;
            }
        } else {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const oldUsername = userDoc.data().username;
            if (oldUsername && oldUsername !== username) {
                await db.collection('usernames').doc(oldUsername).delete();
                await db.collection('usernames').doc(username).set({
                    uid: user.uid,
                    email: user.email,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else if (!oldUsername) {
                await db.collection('usernames').doc(username).set({
                    uid: user.uid,
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        await db.collection('users').doc(user.uid).update({
            username: username,
            phone: phone,
            address: address,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showCustomAlert('Profile updated successfully!', 'success');
        setupUserProfile(user);
    } catch (error) {
        console.error('Error updating profile:', error);
        showCustomAlert('Failed to update profile: ' + error.message, 'error');
    }
});

async function loadActiveBids(user) {
    const grid = document.getElementById('activeBidsGrid');
    try {
        const now = new Date().getTime();
        const productsSnapshot = await db.collection('products')
            .where('highestBidderUid', '==', user.uid)
            .get();
        
        let activeBids = [];
        productsSnapshot.forEach(doc => {
            const p = doc.data();
            const startTime = p.createdAt ? p.createdAt.toMillis() : now;
            const endTime = startTime + (p.durationMs || 10800000);
            if (endTime > now && !p.deleted && p.status === 'active') {
                activeBids.push({ id: doc.id, ...p, endTime });
            }
        });

        if (activeBids.length === 0) {
            grid.innerHTML = '<p class="empty-msg">You have no active bids.</p>';
            return;
        }

        grid.innerHTML = '';
        activeBids.forEach(bid => {
            const timeLeft = Math.max(0, bid.endTime - now);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            const timerStr = `${hours}h ${minutes}m ${seconds}s`;

            const card = document.createElement('div');
            card.className = 'bid-card';
            card.innerHTML = `
                <h3>${bid.name}</h3>
                <p class="price">₹${bid.price}</p>
                <p class="timer">⏳ ${timerStr}</p>
                <a href="product.html?id=${bid.id}">View Auction</a>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading active bids:', error);
        grid.innerHTML = '<p class="empty-msg">Error loading bids.</p>';
    }
}

async function loadWonAuctions(user) {
    const grid = document.getElementById('wonAuctionsGrid');
    try {
        const historySnapshot = await db.collection('history')
            .where('highestBidderUid', '==', user.uid)
            .orderBy('soldAt', 'desc')
            .get();

        if (historySnapshot.empty) {
            grid.innerHTML = '<p class="empty-msg">You haven\'t won any auctions yet.</p>';
            return;
        }

        grid.innerHTML = '';
        historySnapshot.forEach(doc => {
            const h = doc.data();
            const date = h.soldAt ? new Date(h.soldAt.toDate()).toLocaleDateString() : 'Unknown date';
            const card = document.createElement('div');
            card.className = 'bid-card';
            card.innerHTML = `
                <h3>${h.name}</h3>
                <p class="price">₹${h.price}</p>
                <p style="color: #888;">Won on: ${date}</p>
                ${h.transactionId ? `<p style="font-size:0.8rem; color:#2addef;">Transaction: ${h.transactionId}</p>` : ''}
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading won auctions:', error);
        grid.innerHTML = '<p class="empty-msg">Error loading history.</p>';
    }
}

window.resetPassword = function() {
    const user = auth.currentUser;
    if (!user) return;
    auth.sendPasswordResetEmail(user.email)
        .then(() => {
            showCustomAlert('Password reset email sent. Please check your inbox.', 'success');
        })
        .catch(error => {
            showCustomAlert('Error: ' + error.message, 'error');
        });
};

window.logout = function() {
    auth.signOut().then(() => { 
        window.location.href = 'login.html'; 
    });
};