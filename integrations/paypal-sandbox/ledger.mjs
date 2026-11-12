// PostgreSQL ledger for PayPal Sandbox. Atomic deduplication and immutable ownership.
export async function openLedger(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL not configured');
  const {Pool}=await import('pg');
  const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:5000,ssl:process.env.PGSSLMODE==='require'?{rejectUnauthorized:true}:false});
  await pool.query(`CREATE TABLE IF NOT EXISTS celeste_orders (
    order_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, product TEXT NOT NULL,
    amount_eur TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'CREATED',
    capture_id TEXT UNIQUE, idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(session_id,idempotency_key))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS celeste_webhook_events (
    event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now())`);
  return {
    async byId(id){return (await pool.query('SELECT * FROM celeste_orders WHERE order_id=$1',[id])).rows[0]||null},
    async byKey(sid,key){return (await pool.query('SELECT * FROM celeste_orders WHERE session_id=$1 AND idempotency_key=$2',[sid,key])).rows[0]||null},
    async create(o){await pool.query('INSERT INTO celeste_orders(order_id,session_id,product,amount_eur,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(session_id,idempotency_key) DO NOTHING',[o.id,o.sid,o.product,o.amount,o.key]);return this.byKey(o.sid,o.key)},
    async startCapture(id){const r=await pool.query(`UPDATE celeste_orders SET state='CAPTURING',updated_at=now() WHERE order_id=$1 AND state IN ('CREATED','APPROVED') RETURNING *`,[id]);return r.rows[0]||null},
    async captured(id,captureId){await pool.query(`UPDATE celeste_orders SET state='COMPLETED',capture_id=$2,updated_at=now() WHERE order_id=$1 AND state NOT IN ('REFUNDED','REVERSED')`,[id,captureId])},
    async recordEvent(event){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const ins=await client.query('INSERT INTO celeste_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.event_type]);
        if(!ins.rowCount){await client.query('COMMIT');return false}
        const oid=event.resource?.supplementary_data?.related_ids?.order_id;
        if(typeof oid==='string'){
          const order=(await client.query('SELECT * FROM celeste_orders WHERE order_id=$1 FOR UPDATE',[oid])).rows[0];
          if(order){
            if(event.event_type==='CHECKOUT.ORDER.APPROVED')await client.query(`UPDATE celeste_orders SET state='APPROVED',updated_at=now() WHERE order_id=$1 AND state='CREATED'`,[oid]);
            if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'&&event.resource?.status==='COMPLETED'&&event.resource?.amount?.currency_code==='EUR'&&event.resource?.amount?.value===order.amount_eur&&typeof event.resource.id==='string')await client.query(`UPDATE celeste_orders SET state='COMPLETED',capture_id=$2,updated_at=now() WHERE order_id=$1 AND state NOT IN ('REFUNDED','REVERSED')`,[oid,event.resource.id]);
            if(event.event_type==='PAYMENT.CAPTURE.REFUNDED')await client.query(`UPDATE celeste_orders SET state='REFUNDED',updated_at=now() WHERE order_id=$1`,[oid]);
            if(event.event_type==='PAYMENT.CAPTURE.REVERSED')await client.query(`UPDATE celeste_orders SET state='REVERSED',updated_at=now() WHERE order_id=$1`,[oid]);
          }
        }
        await client.query('COMMIT');return true;
      }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    },
    async close(){await pool.end()}
  };
}
