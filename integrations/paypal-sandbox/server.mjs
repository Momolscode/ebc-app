// Céleste PayPal sandbox integration — isolated prototype, NOT production-ready.
// Requires Node.js 20+. No secrets or payment entitlements are stored here.
// Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in a private server environment.
// Only approved server-side products are accepted; the browser cannot set prices.
import http from 'node:http';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {openLedger} from './ledger.mjs';
import {validateOrderShape,validateCaptureShape} from './validators.mjs';

const PORT = Number(process.env.PORT || 8787);
const PAYPAL = 'https://api-m.sandbox.paypal.com';
const PRODUCTS = Object.freeze({
  // To enable testing, the project owner must configure this using an approved offer.
  // Example environment: CELESTE_TEST_PRICE_EUR=1.00
  celeste_test: process.env.CELESTE_TEST_PRICE_EUR || '',
});
const ORIGIN = process.env.CELESTE_ALLOWED_ORIGIN || 'http://127.0.0.1:8765';
const VALID_PRICE = /^\d{1,5}\.\d{2}$/;
let ledger;
const SESSION_SECRET=process.env.CELESTE_SESSION_SECRET||'';
const MERCHANT_ID=process.env.PAYPAL_MERCHANT_ID||'';
const enabled=()=>process.env.CELESTE_SANDBOX_API_ENABLED==='true' && !!ledger && SESSION_SECRET.length>=32 && !!MERCHANT_ID && !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET && VALID_PRICE.test(PRODUCTS.celeste_test) && Number(PRODUCTS.celeste_test)>0;
function sig(x){return createHmac('sha256',SESSION_SECRET).update(x).digest('hex')}
function session(req){const p=String(req.headers.authorization||'').replace(/^Bearer /,'').split('.');if(p.length!==3||!/^[a-f0-9]{40}$/.test(p[0])||!/^[a-f0-9]{64}$/.test(p[2]))return null;return Number(p[1])>Date.now()&&timingSafeEqual(Buffer.from(sig(p[0]+'.'+p[1])),Buffer.from(p[2]))?p[0]:null}
function token(){const id=randomBytes(20).toString('hex'),exp=Date.now()+3600000,p=id+'.'+exp;return p+'.'+sig(p)}

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
  if(req.url==='/health' && req.method==='GET')return json(res,200,{status:'ok',mode:'sandbox-disabled',paymentsEnabled:enabled()});
  // Public deployment is a readiness check only. Never permit payment activity
  // until a separate authenticated server and durable ledger are in place.
  if(!enabled())return fail(res,503,'Sandbox payment API disabled');
  if(req.method==='OPTIONS'){return json(res,200,{ok:true});}
  if(req.headers.origin!==ORIGIN)return fail(res,403,'Origin not allowed');
  if(req.method!=='POST')return fail(res,405,'Method not allowed');
  try{
    if(req.url==='/api/paypal/session'&&req.method==='GET')return json(res,200,{token:token(),expiresIn:3600});
    if(req.url==='/api/paypal/webhook'){
      // Verify notification authenticity with PayPal. This sandbox prototype never grants access.
      const webhookId=process.env.PAYPAL_WEBHOOK_ID;
      if(!webhookId)return fail(res,503,'Sandbox webhook is not configured');
      const headers=req.headers;
      const names={
        transmission_id:'paypal-transmission-id',
        transmission_time:'paypal-transmission-time',
        cert_url:'paypal-cert-url',
        auth_algo:'paypal-auth-algo',
        transmission_sig:'paypal-transmission-sig'
      };
      const verification={webhook_id:webhookId,webhook_event:await body(req)};
      for(const [name,header] of Object.entries(names)){
        if(typeof headers[header]!=='string' || !headers[header])return fail(res,400,'Missing webhook signature header');
        verification[name]=headers[header];
      }
      // PayPal's verification endpoint is called on the server; never trust browser assertions.
      const response=await paypal('POST','/v1/notifications/verify-webhook-signature',verification);
      if(response.verification_status!=='SUCCESS')return fail(res,401,'Webhook signature invalid');
      const event=verification.webhook_event;
      if(typeof event.id!=='string' || typeof event.event_type!=='string')return fail(res,400,'Invalid webhook event');
      // Deliberately log only non-sensitive event metadata, not buyer data.
      const fresh=await ledger.recordEvent(event);
      console.log(JSON.stringify({eventId:event.id,eventType:event.event_type,verified:true,duplicate:!fresh}));
      return json(res,200,{received:true,verified:true});
    }
    if(req.url==='/api/paypal/orders'){
      const sid=session(req);if(!sid)return fail(res,401,'Session required');
      const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,96}$/.test(key))return fail(res,400,'Idempotency key required');
      const input=await body(req), amount=PRODUCTS[input.product];
      if(!amount || !VALID_PRICE.test(amount))return fail(res,422,'Approved offer not configured');
      const existing=await ledger.byKey(sid,key);if(existing)return json(res,200,{id:existing.order_id,status:existing.state});
      const requestId=createHash('sha256').update(sid+':'+key).digest('hex').slice(0,48);
      const order=await paypal('POST','/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:'celeste_test',amount:{currency_code:'EUR',value:amount}}]},requestId);
      if(!/^[A-Z0-9]{8,32}$/.test(order.id||''))throw Error('Invalid PayPal order ID');
      const stored=await ledger.create({id:order.id,sid,product:input.product,amount,key});
      return json(res,201,{id:stored.order_id,status:stored.state});
    }
    if(req.url==='/api/paypal/capture'){
      const sid=session(req);if(!sid)return fail(res,401,'Session required');
      const input=await body(req);
      if(!/^[A-Z0-9]{8,32}$/.test(input.orderID||''))return fail(res,400,'Invalid order ID');
      const stored=await ledger.byId(input.orderID);if(!stored||stored.session_id!==sid)return fail(res,404,'Unknown order');
      if(stored.state==='COMPLETED')return json(res,200,{id:input.orderID,status:'COMPLETED'});
      if(['CAPTURING','REFUNDED','REVERSED'].includes(stored.state))return fail(res,409,'Capture not available');
      const approval=await paypal('GET','/v2/checkout/orders/'+input.orderID);
      if(!validateOrderShape(approval,stored.amount_eur,MERCHANT_ID))return fail(res,409,'Amount, merchant or approval mismatch');
      if(!await ledger.startCapture(input.orderID))return fail(res,409,'Capture already processing');
      // This prototype ONLY captures sandbox orders. It deliberately grants no customer entitlement.
      // Production requires durable state, idempotency, verified amount/payee and webhook-driven fulfillment.
      const capture=await paypal('POST','/v2/checkout/orders/'+input.orderID+'/capture',{},'celeste-'+createHash('sha256').update(input.orderID).digest('hex').slice(0,40));
      const captureId=validateCaptureShape(capture,stored.amount_eur,MERCHANT_ID);
      if(!captureId)return fail(res,409,'Capture unverified');
      await ledger.captured(input.orderID,captureId);
      return json(res,200,{id:input.orderID,status:'COMPLETED'});
    }
    return fail(res,404,'Not found');
  }catch(e){console.error('PayPal sandbox operation failed:',e.message);return fail(res,502,'Sandbox PayPal request failed');}
}
if(process.env.CELESTE_SANDBOX_API_ENABLED==='true'){
  try{ledger=await openLedger(process.env.DATABASE_URL)}catch(e){console.error('Ledger unavailable:',e.message);process.exit(1)}
}
http.createServer(handler).listen(PORT,()=>console.log('Celeste PayPal SANDBOX prototype on '+PORT));
