// registrations.js
// Helper functions for registration fee management

async function checkRegistrationFee(productId, userId) {
    try {
        const registrationRef = db.collection("registrations").doc(`${productId}_${userId}`);
        const registrationDoc = await registrationRef.get();
        
        if (registrationDoc.exists) {
            return {
                paid: true,
                data: registrationDoc.data()
            };
        }
        return { paid: false };
    } catch (error) {
        console.error("Error checking registration fee:", error);
        return { paid: false, error: error.message };
    }
}

async function getRegistrationFeeStatusForProduct(productId) {
    const user = auth.currentUser;
    if (!user) return { paid: false, requiresLogin: true };
    
    return await checkRegistrationFee(productId, user.uid);
}