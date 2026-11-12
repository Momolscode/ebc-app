import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrderShape,validateCaptureShape,PRICE} from './validators.mjs';
const merchant='merchant_1234',unit={amount:{currency_code:'EUR',value:'2.00'},payee:{merchant_id:merchant}};
test('reject altered amount, currency, merchant or unapproved order',()=>{
 assert.equal(validateOrderShape({status:'APPROVED',purchase_units:[unit]},'2.00',merchant),true);
 assert.equal(validateOrderShape({status:'APPROVED',purchase_units:[unit]},'5.00',merchant),false);
 assert.equal(validateOrderShape({status:'APPROVED',purchase_units:[unit]},'2.00','wrong'),false);
 assert.equal(validateOrderShape({status:'CREATED',purchase_units:[unit]},'2.00',merchant),false);
 assert.equal(validateOrderShape({status:'APPROVED',purchase_units:[{...unit,amount:{currency_code:'USD',value:'2.00'}}]},'2.00',merchant),false);
});
test('capture must match amount, merchant and COMPLETED',()=>{
 const r={purchase_units:[{...unit,payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',amount:unit.amount}]}}]};
 assert.equal(validateCaptureShape(r,'2.00',merchant),'CAPTURE123');
 assert.equal(validateCaptureShape(r,'3.00',merchant),null);
 assert.equal(validateCaptureShape(r,'2.00','wrong'),null);
 assert.equal(validateCaptureShape({purchase_units:[{...unit,payments:{captures:[{id:'CAPTURE123',status:'PENDING',amount:unit.amount}]}}]},'2.00',merchant),null);
});
test('only two-decimal euro amounts',()=>{for(const x of ['1.00','99999.99'])assert.ok(PRICE.test(x));for(const x of ['0','-1.00','1.001','1,00'])assert.ok(!PRICE.test(x))});
