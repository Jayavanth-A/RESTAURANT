/**
 * Input validation middleware
 * All validation happens server-side. Never trust client data.
 */

function validateOrder(req, res, next) {
  const { customerName, customerPhone, deliveryAddress, deliveryMode, items } = req.body;
  const errors = [];

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
    errors.push('Valid customer name is required (min 2 characters)');
  }
  if (!customerPhone || !/^[+]?[0-9\s\-]{8,15}$/.test(customerPhone.trim())) {
    errors.push('Valid phone number is required');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('At least one item must be ordered');
  }
  if (deliveryMode && !['dinein', 'takeaway', 'delivery'].includes(deliveryMode)) {
    errors.push('Invalid delivery mode');
  }
  if (deliveryMode === 'delivery') {
    if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5) {
      errors.push('Delivery address is required for delivery orders');
    }
  }

  // Validate items
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (!item.menuItemId || typeof item.menuItemId !== 'string') {
        errors.push('Invalid menu item ID');
        break;
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        errors.push('Invalid quantity (must be 1-99)');
        break;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // Sanitize inputs
  req.body.customerName = customerName.trim();
  req.body.customerPhone = customerPhone.trim();
  req.body.deliveryAddress = deliveryAddress ? deliveryAddress.trim() : null;
  req.body.specialInstructions = req.body.specialInstructions ? String(req.body.specialInstructions).trim().slice(0, 500) : null;

  next();
}

function validatePayment(req, res, next) {
  const { paymentId, orderId } = req.body;

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ error: 'Payment ID is required' });
  }
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Order ID is required' });
  }

  next();
}

function validateStatusUpdate(req, res, next) {
  const { status } = req.body;
  const validStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  next();
}

module.exports = { validateOrder, validatePayment, validateStatusUpdate };
