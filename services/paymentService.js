/**
 * Demo Payment Service
 * Simulates payment processing with backend verification.
 * NEVER trust frontend payment status - this service is the source of truth.
 *
 * To replace with Razorpay later:
 * 1. Replace processDemoPayment with razorpay.orders.create()
 * 2. Add webhook verification in verifyPayment
 * 3. Update the frontend payment UI to use Razorpay checkout
 */

const { v4: uuidv4 } = require('uuid');

// Simulated payment failure rate (0 = never fails, 1 = always fails)
const DEMO_FAIL_RATE = 0;

/**
 * Process a demo payment
 * @param {Object} params
 * @param {number} params.amount - Amount in INR
 * @param {string} params.paymentMethod - 'demo_card' | 'demo_upi'
 * @param {string} params.orderId - Associated order ID
 * @param {Object} db - Database instance
 * @returns {Object} payment record
 */
function processDemoPayment({ amount, paymentMethod, orderId, db }) {
  const paymentId = `DEMO_PAY_${Date.now()}_${uuidv4().slice(0, 6).toUpperCase()}`;
  const paymentRef = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Record payment as processing
  db.prepare(`
    INSERT INTO payments (id, order_id, payment_method, amount, status, payment_reference)
    VALUES (?, ?, ?, ?, 'processing', ?)
  `).run(paymentId, orderId, paymentMethod, amount, paymentRef);

  return { paymentId, paymentRef, status: 'processing' };
}

/**
 * Verify and complete a demo payment
 * This is the BACKEND VERIFICATION step - never trust the frontend.
 *
 * @param {string} paymentId
 * @param {Object} db - Database instance
 * @returns {Object} { success, payment, reason }
 */
function verifyDemoPayment(paymentId, db) {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);

  if (!payment) {
    return { success: false, payment: null, reason: 'Payment not found' };
  }

  if (payment.status === 'success') {
    // Idempotent: already verified
    return { success: true, payment, reason: 'Already verified' };
  }

  if (payment.status === 'failed') {
    return { success: false, payment, reason: 'Payment previously failed' };
  }

  // Simulate: random failure for demo purposes
  const shouldFail = Math.random() < DEMO_FAIL_RATE;

  if (shouldFail) {
    db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(paymentId);
    return { success: false, payment: { ...payment, status: 'failed' }, reason: 'Simulated payment failure' };
  }

  // Payment verified successfully
  const now = new Date().toISOString();
  db.prepare("UPDATE payments SET status = 'success', verified_at = ? WHERE id = ?").run(now, paymentId);

  return {
    success: true,
    payment: { ...payment, status: 'success', verified_at: now },
    reason: 'Payment verified',
  };
}

/**
 * Get payment details
 */
function getPayment(paymentId, db) {
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
}

module.exports = { processDemoPayment, verifyDemoPayment, getPayment };
