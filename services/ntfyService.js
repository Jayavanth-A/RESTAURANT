/**
 * ntfy Notification Service
 * Sends push notifications to the restaurant owner via ntfy.
 *
 * Security: ntfy config is ONLY in the backend. Never exposed to frontend.
 *
 * Architecture:
 *   Backend → HTTP POST → ntfy server → Restaurant owner's phone
 */

const NTFY_SERVER_URL = process.env.NTFY_SERVER_URL || 'https://ntfy.sh';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'restaurant-orders-8f72x91k';

/**
 * Send a new order notification to the restaurant owner
 * Called ONLY after backend payment verification + order confirmation.
 *
 * @param {Object} order - Verified order with items
 */
async function sendNewOrderNotification(order) {
  const itemsList = order.items
    .map(i => `${i.name} × ${i.quantity}`)
    .join('\n');

  const message = `🍔 NEW PAID ORDER

Order #${order.order_number}

Customer:
${order.customer_name}
${order.customer_phone}

Items:
${itemsList}

Total:
₹${order.total_amount}

Delivery Distance:
${order.distance_km ? order.distance_km + ' km' : 'N/A'}

Estimated Time:
${order.estimated_minutes ? order.estimated_minutes + ' minutes' : 'N/A'}

Payment:
SUCCESSFUL ✓`;

  try {
    const response = await fetch(`${NTFY_SERVER_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': `🍕 New Order #${order.order_number}`,
        'Tags': 'warning,star',
        'Priority': 'high',
      },
      body: message,
    });

    if (!response.ok) {
      console.error(`ntfy notification failed: HTTP ${response.status}`);
      // Don't throw — notification failure should not affect order status
      return false;
    }

    console.log(`✅ ntfy notification sent for Order #${order.order_number}`);
    return true;
  } catch (err) {
    console.error('ntfy notification error:', err.message);
    // Don't throw — notification failure should not affect order status
    return false;
  }
}

/**
 * Send a status update notification
 */
async function sendStatusUpdateNotification(order, newStatus) {
  const statusEmoji = {
    confirmed: '👨‍🍳',
    preparing: '🔥',
    ready: '📦',
    out_for_delivery: '🛵',
    delivered: '✅',
    cancelled: '❌',
  };

  const message = `Order #${order.order_number} is now: ${newStatus.toUpperCase()}

Customer: ${order.customer_name}
Total: ₹${order.total_amount}`;

  try {
    await fetch(`${NTFY_SERVER_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': `${statusEmoji[newStatus] || '📋'} Order #${order.order_number}: ${newStatus}`,
        'Tags': 'white_check_mark',
        'Priority': 'default',
      },
      body: message,
    });
    return true;
  } catch (err) {
    console.error('ntfy status update error:', err.message);
    return false;
  }
}

module.exports = { sendNewOrderNotification, sendStatusUpdateNotification };
