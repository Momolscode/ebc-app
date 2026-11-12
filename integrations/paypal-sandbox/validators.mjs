export const PRICE = /^\d{1,5}\.\d{2}$/;
export const ID = /^[A-Za-z0-9_-]{8,96}$/;
export function validateOrderShape(order, expectedAmount, merchantId) {
  if (!order || !['APPROVED','COMPLETED'].includes(order.status)) return false;
  if (!Array.isArray(order.purchase_units) || order.purchase_units.length!==1) return false;
  const unit=order.purchase_units[0];
  if (unit.amount?.currency_code !== 'EUR' || unit.amount?.value !== expectedAmount) return false;
  if (!merchantId || unit.payee?.merchant_id !== merchantId) return false;
  return true;
}
export function validateCaptureShape(capture, expectedAmount, merchantId) {
  const unit=capture?.purchase_units?.[0];
  const c=unit?.payments?.captures?.[0];
  if (!unit || !c || c.status !== 'COMPLETED') return null;
  if (c.amount?.currency_code!=='EUR' || c.amount?.value!==expectedAmount) return null;
  if (!merchantId || unit.payee?.merchant_id !== merchantId) return null;
  return typeof c.id==='string'? c.id : null;
}
