// Céleste PayPal sandbox integration — isolated prototype, NOT production-ready.
// Requires Node.js 20+. No secrets or payment entitlements are stored here.
// Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in a private server environment.
// Only approved server-side products are accepted; the browser cannot set prices.
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const PAYPAL = 'https://api-m.sandbox.paypal.com';
const PRODUCTS = Object.freeze({
  // To enable testing, the project owner must configure this using an approved offer.
  // Example environment: CELESTE_TEST_PRICE_EUR=1.00
  celeste_test: process.env.CELESTE_TEST_PRICE_EUR || '',
});
const ORIGIN = process.env.CELESTE_ALLOWED_ORIGIN || 'http://127.0.0.1:8765';
const VALID_PRICE = /^\\d{1,5}\\.\\d{2}$/;

function json(res, code, data) {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
    'Access-Control-Allow-Origin': ORIGIN, 'Vary':'Origin',
    'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS'});
  res.end(JSON.stringify(data));
}
function fail(res, code, message) { json(res,code,{error:message}); }
async function body(req) {
  let data = ''; for await (const chunk of req) {
    data += chunk.toString(); if (data.length > 100000) throw new Error('body too large');
  }
  return JSON.parse(data || '{}');
}
async function token() {
  const id=process.env.PAYPAL_CLIENT_ID, secret=process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal sandbox credentials not configured');
  const auth=Buffer.from(id+':'+secret).toString('base64');
  const r=await fetch(PAYPAL+'/v1/oauth2/token', {
    method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'
  });
  if(!r.ok) throw new Error('PayPal authentication failed');
  return (await r.json()).access_token;
}
async function paypal(method,path,payload,requestId) {
  const headers={Authorization:'Bearer '+await token(),'Content-Type':'application/json'};
  if(requestId)headers['PayPal-Request-Id']=requestId;
  const r=await fetch(PAYPAL+path,{method,headers,body:JSON.stringify(payload)});
  const result=await r.json();
  if(!r.ok)throw new Error('PayPal API request failed: '+r.status);
  return result;
}
async function handler(req,res) {
  if(req.method==='OPTIONS'){return json(res,200,{ok:true});}
  if(req.headers.origin && req.headers.origin!==ORIGIN)return fail(res,403,'Origin not allowed');
  if(req.method!=='POST')return fail(res,405,'Method not allowed');
  try{
    if(req.url==='/api/paypal/orders'){
      const input=await body(req), amount=PRODUCTS[input.product];
      if(!amount || !VALID_PRICE.test(amount))return fail(res,422,'Approved offer not configured');
      const order=await paypal('POST','/v2/checkout/orders',{intent:'CAPTURE',
        purchase_units:[{reference_id:'celeste_test',amount:{currency_code:'EUR',value:amount}}]});
      return json(res,201,{id:order.id,status:order.status});
    }
    if(req.url==='/api/paypal/capture'){
      const input=await body(req);
      if(!/^[A-Z0-9]{8,32}$/.test(input.orderID||''))return fail(res,400,'Invalid order ID');
      // This prototype ONLY captures sandbox orders. It deliberately grants no customer entitlement.
      // Production requires durable state, idempotency, verified amount/payee and webhook-driven fulfillment.
      const capture=await paypal('POST','/v2/checkout/orders/'+input.orderID+'/capture',{},input.orderID);
      return json(res,200,{id:capture.id,status:capture.status});
    }
    return fail(res,404,'Not found');
  }catch(e){console.error('PayPal sandbox operation failed:',e.message);return fail(res,502,'Sandbox PayPal request failed');}
}
http.createServer(handler).listen(PORT,()=>console.log('Celeste PayPal SANDBOX prototype on '+PORT));
