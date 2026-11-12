// Non-payment smoke tests: ensure this prototype rejects invalid and unconfigured calls.
// Execute locally: node --test integrations/paypal-sandbox/server.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

test('sandbox routes require approved offer and webhook configuration', async () => {
  const port=24000 + Math.floor(Math.random()*20000);
  const proc=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{
    env:{...process.env, PORT:String(port), PAYPAL_CLIENT_ID:'', PAYPAL_CLIENT_SECRET:'',
      CELESTE_TEST_PRICE_EUR:'', PAYPAL_WEBHOOK_ID:''},
    stdio:'ignore'
  });
  try {
    let up=false;
    for(let attempt=0;attempt<40;attempt++){
      try {
        const res=await fetch('http://127.0.0.1:'+port+'/api/paypal/orders',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({product:'celeste_test'})
        });
        assert.equal(res.status,422);
        up=true;break;
      }catch {await delay(50);}
    }
    assert.equal(up,true,'test server did not start');
    const res=await fetch('http://127.0.0.1:'+port+'/api/paypal/webhook',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:'{}'
    });
    assert.equal(res.status,503);
    const cors=await fetch('http://127.0.0.1:'+port+'/api/paypal/orders',{
      method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},
      body:'{}'
    });
    assert.equal(cors.status,403);
  } finally {proc.kill();}
});
