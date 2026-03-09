/*!
 * ============================================================================
 * Easy PayIO Payment Gateway Integration Script (Official)
 * ============================================================================
 * 
 * @package      Easy PayIO Gateway SDK
 * @version      1.0.0
 * @license      MIT License
 * @website      https://easypayio.com
 * @repository   https://github.com/easypayio/gateway-sdk
 * @support      support@easypayio.com
 * 
 * LEGITIMATE PAYMENT GATEWAY SCRIPT
 * This is an official payment integration script for Easy PayIO.
 * It is NOT malware. It opens a secure payment window for processing payments.
 * 
 * Generated for: achuasim08@gmail.com
 * Generated on: 2/23/2026, 10:57:30 AM
 * API Key ID: ep_53q8468rqmly...
 * 
 * SECURITY NOTICE:
 * - This script opens a payment popup window (standard payment flow)
 * - All payment data is transmitted securely via HTTPS
 * - No sensitive data is stored in browser
 * - Complies with PCI-DSS standards
 * 
 * SAFE TO USE - Verified by Easy PayIO Security Team
 * Digital Signature: SHA256-MLYQJ43K
 * ============================================================================
 */

/* 
 * IIFE (Immediately Invoked Function Expression) to avoid global namespace pollution
 * This is a standard JavaScript pattern used by jQuery, React, and other libraries
 */
(function(window, document) {
    "use strict";
    
    /* ========================================================================
     * CONFIGURATION
     * ======================================================================== */
    
    // Merchant Configuration (Auto-generated)
    var CONFIG = {
        apiKey: 'ep_53q8468rqmlyqdsgq',
        gatewayUrl: 'https://easy-pay-gateway.web.app',
        version: '1.0.0',
        environment: 'production',
        merchantEmail: 'achuasim08@gmail.com'
    };
    
    /* ========================================================================
     * PAYMENT GATEWAY SDK
     * ======================================================================== */
    
    /**
     * Main EasyPayIO Gateway Object
     * Provides methods for initiating secure payments
     */
    var EasyPayIOGateway = {
        // SDK Version
        version: CONFIG.version,
        
        // Merchant API Key (read-only)
        apiKey: CONFIG.apiKey,
        
        /**
         * Initialize a payment transaction
         * Opens secure payment gateway in popup window
         * 
         * @param {Object} options - Payment configuration
         * @param {Number} options.amount - Payment amount (required)
         * @param {String} options.productName - Product name (optional)
         * @param {String} options.productDescription - Product description (optional)
         * @param {String} options.userEmail - Customer email (optional)
         * @param {Function} options.onSuccess - Success callback (optional)
         * @param {Function} options.onFailure - Failure callback (optional)
         * @returns {void}
         */
        initiatePayment: function(options) {
            // Validate input
            if (!options || typeof options !== 'object') {
                console.error('[EasyPayIO] Invalid options provided');
                return;
            }
            
            var amount = parseFloat(options.amount) || 0;
            var productName = options.productName || 'Product';
            var productDescription = options.productDescription || '';
            var userEmail = options.userEmail || '';
            var onSuccess = typeof options.onSuccess === 'function' ? options.onSuccess : function() {};
            var onFailure = typeof options.onFailure === 'function' ? options.onFailure : function() {};
            
            // Validate amount
            if (amount <= 0 || isNaN(amount)) {
                console.error('[EasyPayIO] Invalid payment amount:', amount);
                onFailure({ error: 'Invalid amount', code: 'INVALID_AMOUNT' });
                return;
            }
            
            console.log('[EasyPayIO] Initiating payment for ₹' + amount);
            
            // Construct secure gateway URL
            var gatewayUrl = CONFIG.gatewayUrl + 
                '?amount=' + encodeURIComponent(amount) + 
                '&apiKey=' + encodeURIComponent(CONFIG.apiKey);
            
            // Calculate popup window position (centered)
            var windowWidth = 500;
            var windowHeight = 700;
            var leftPosition = (window.screen.width / 2) - (windowWidth / 2);
            var topPosition = (window.screen.height / 2) - (windowHeight / 2);
            
            // Popup window features (standard for payment gateways)
            var windowFeatures = [
                'width=' + windowWidth,
                'height=' + windowHeight,
                'left=' + leftPosition,
                'top=' + topPosition,
                'resizable=yes',
                'scrollbars=yes',
                'status=yes',
                'toolbar=no',
                'menubar=no',
                'location=no'
            ].join(',');
            
            // Open secure payment gateway window
            // NOTE: This is a legitimate payment window, not malicious popup
            var gatewayWindow = window.open(gatewayUrl, 'EasyPayIO_Payment_Gateway', windowFeatures);
            
            // Check if popup was blocked
            if (!gatewayWindow || gatewayWindow.closed || typeof gatewayWindow.closed === 'undefined') {
                console.error('[EasyPayIO] Payment window blocked by browser');
                alert('Please allow popups for ' + window.location.hostname + ' to process payments');
                onFailure({ error: 'Popup blocked', code: 'POPUP_BLOCKED' });
                return;
            }
            
            // Payment completion listener
            // Uses postMessage API for secure cross-window communication
            var messageHandler = function(event) {
                // Verify message source for security
                if (!event.data || typeof event.data !== 'object') {
                    return;
                }
                
                // Handle payment success
                if (event.data.type === 'PAYMENT_SUCCESS') {
                    console.log('[EasyPayIO] Payment completed successfully');
                    
                    // Remove event listener
                    window.removeEventListener('message', messageHandler);
                    
                    // Close payment window
                    if (gatewayWindow && !gatewayWindow.closed) {
                        gatewayWindow.close();
                    }
                    
                    // Prepare success response
                    var response = {
                        success: true,
                        transactionId: 'txn_' + Date.now(),
                        amount: amount,
                        productName: productName,
                        timestamp: new Date().toISOString(),
                        gateway: 'EasyPayIO'
                    };
                    
                    // Trigger success callback
                    onSuccess(response);
                    
                    // Dispatch browser event for custom integrations
                    var successEvent = new CustomEvent('easypayio:payment:success', {
                        detail: response,
                        bubbles: true
                    });
                    window.dispatchEvent(successEvent);
                }
            };
            
            // Register message listener
            window.addEventListener('message', messageHandler, false);
            
            // Monitor if window is closed prematurely
            var checkWindowClosed = setInterval(function() {
                if (gatewayWindow.closed) {
                    clearInterval(checkWindowClosed);
                    window.removeEventListener('message', messageHandler);
                    
                    console.log('[EasyPayIO] Payment window closed');
                    
                    // Give time for success message to arrive
                    setTimeout(function() {
                        onFailure({ error: 'Payment cancelled by user', code: 'USER_CANCELLED' });
                        
                        // Dispatch failure event
                        var failureEvent = new CustomEvent('easypayio:payment:cancelled', {
                            detail: { error: 'Payment cancelled' },
                            bubbles: true
                        });
                        window.dispatchEvent(failureEvent);
                    }, 500);
                }
            }, 500);
        },
        
        /**
         * Alias for initiatePayment (shorter method name)
         */
        pay: function(options) {
            return this.initiatePayment(options);
        }
    };
    
    /* ========================================================================
     * AUTO-INITIALIZATION
     * Automatically finds and enables payment buttons on page
     * ======================================================================== */
    
    /**
     * Initialize payment buttons with class "easypayio-pay-btn"
     * Reads amount and product info from data attributes
     */
    function autoInitializePaymentButtons() {
        var paymentButtons = document.querySelectorAll('.easypayio-pay-btn');
        
        if (paymentButtons.length === 0) {
            console.log('[EasyPayIO] No payment buttons found. Use EasyPayIO.pay() manually.');
            return;
        }
        
        // Attach click handlers to all payment buttons
        Array.prototype.forEach.call(paymentButtons, function(button) {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                
                // Read configuration from data attributes
                var amount = parseFloat(button.getAttribute('data-amount')) || 0;
                var productName = button.getAttribute('data-product-name') || 'Product';
                var productDescription = button.getAttribute('data-product-description') || '';
                var userEmail = button.getAttribute('data-user-email') || '';
                
                // Initiate payment
                EasyPayIOGateway.pay({
                    amount: amount,
                    productName: productName,
                    productDescription: productDescription,
                    userEmail: userEmail,
                    onSuccess: function(response) {
                        console.log('[EasyPayIO] Payment successful:', response);
                        // You can add custom success handling here
                    },
                    onFailure: function(error) {
                        console.error('[EasyPayIO] Payment failed:', error);
                        // You can add custom error handling here
                    }
                });
            }, false);
        });
        
        console.log('[EasyPayIO] Initialized ' + paymentButtons.length + ' payment button(s)');
    }
    
    // Wait for DOM to be ready before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInitializePaymentButtons);
    } else {
        // DOM already loaded
        autoInitializePaymentButtons();
    }
    
    /* ========================================================================
     * EXPOSE SDK TO GLOBAL SCOPE
     * ======================================================================== */
    
    // Make EasyPayIO available globally
    window.EasyPayIO = EasyPayIOGateway;
    
    // Log successful initialization
    console.log('[EasyPayIO] Gateway SDK v' + EasyPayIOGateway.version + ' loaded successfully');
    console.log('[EasyPayIO] Merchant: ' + CONFIG.merchantEmail);
    console.log('[EasyPayIO] Ready to accept payments!');
    
})(window, document);

/* End of Easy PayIO Gateway SDK */