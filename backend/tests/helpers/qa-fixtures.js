import { SMTPServer } from "smtp-server";
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import pg from 'pg';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { ensureTestExtension } from './test-extension.js';

export const databaseUrl = process.env.TEST_DATABASE_URL;
export const databaseSkip = !databaseUrl && 'Requires a disposable TEST_DATABASE_URL ending in _test';

export function testDatabase(value) {
  assert.ok(value, 'Set TEST_DATABASE_URL explicitly; there is no production fallback');
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.match(decodeURIComponent(url.pathname), /_test$/, 'Only a disposable database ending in _test is allowed');
  return url;
}

// كل ملف اختبار له مساحة مستقلة عشان بيانات الاختبارات ما تتداخل.
// هذا نجاح تجريبي للاختبار، مو تأكيد من البنك.
export async function setupQa(label) {
  const baseUrl = testDatabase(databaseUrl);
  const schema = 'qa_' + label + '_' + randomBytes(6).toString('hex');
  const control = new pg.Pool({ connectionString: baseUrl.toString() });
  await ensureTestExtension(control);
  await control.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(baseUrl);
  url.searchParams.set('options', `-c search_path=${schema},public`);
  url.searchParams.set('application_name', schema);
  process.env.DATABASE_URL = url.toString();
  process.env.UPLOAD_DIR = await mkdtemp(join(tmpdir(), 'mezyad-images-'));
  const { pool } = await import('../../src/db.js');
  const { app } = await import('../../src/app.js');
  for (const name of ['001_schema.sql','002_private_auction_code_lookup.sql','003_email_and_moyasar.sql']) {
    await pool.query(await readFile(new URL('../../../database/migrations/'+name, import.meta.url), 'utf8'));
  }
  // تم التعديل من عبير: بريد محلي للاختبار فقط والتاكيدات ادناه محاكاه مو نجاح ميسر رسمي.
  const emails=[];
  const smtp=new SMTPServer({authOptional:true,disabledCommands:['AUTH','STARTTLS'],onData(stream,session,done){
    const chunks=[];stream.on('data',chunk=>chunks.push(chunk));stream.on('end',()=>{emails.push({email:session.envelope.rcptTo[0].address,raw:Buffer.concat(chunks).toString()});done();});
  }});
  await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));
  process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT=String(smtp.server.address().port);process.env.SMTP_SECURE='false';process.env.SMTP_USER='';
  process.env.MAIL_FROM='Mezyad <no-reply@example.invalid>';process.env.EMAIL_OTP_SECRET=randomBytes(32).toString('hex');
  const payments=new Map(),realFetch=globalThis.fetch;
  globalThis.fetch=async (input,options)=>{
    if (String(input).startsWith('https://api.moyasar.com/v1/payments/')) {
      const payment=payments.get(String(input).split('/').at(-1));
      return new Response(JSON.stringify(payment||{}),{status:payment?200:404,headers:{'Content-Type':'application/json'}});
    }
    return realFetch(input,options);
  };
  function emailCode(email) {
    const raw=emails.filter(e=>e.email===email).at(-1)?.raw||'';
    const body=raw.slice(raw.indexOf('\r\n\r\n')+4);
    const text=/Content-Transfer-Encoding: base64/i.test(raw)?Buffer.from(body.replace(/\s/g,''),'base64').toString():body.replace(/=\r?\n/g,'').replace(/=([a-f0-9]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
    return text.match(/\b\d{6}\b/)?.[0];
  }
  const category = (await pool.query("INSERT INTO categories(name) VALUES('QA synthetic category') RETURNING id")).rows[0];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const passwordHash = await bcrypt.hash('Local-QA-fixture-only', 4);

  async function account(role = 'USER') {
    const user = (await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,role',
      ['Synthetic QA user', randomUUID() + '@example.invalid', passwordHash, role])).rows[0];
    const token = randomBytes(32).toString('hex');
    await pool.query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')",
      [user.id, createHash('sha256').update(token).digest('hex')]);
    return { ...user, token };
  }
  const seller = await account(), bidder = await account(), bidder2 = await account(), admin = await account('ADMIN');

  async function api(path, { method = 'GET', body, token, form } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(form ? { body: form } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    return { status: response.status, json: await response.json() };
  }

  async function item({ owner = seller, status = 'APPROVED', title = 'Synthetic QA listing', fields = {} } = {}) {
    return (await pool.query('INSERT INTO items(seller_id,category_id,title,description,category_fields,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [owner.id, category.id, title, 'Synthetic test data; not a real customer listing.', JSON.stringify(fields), status])).rows[0];
  }

  async function auction({ owner = seller, visibility = 'PUBLIC', start = '-1 hour', end = '1 hour', status = 'ACTIVE', price = 1000, increment = 50 } = {}) {
    const listing = await item({ owner });
    const accessCode=randomBytes(12).toString('hex');
    const privateHash=await bcrypt.hash(accessCode,4);
    const result = (await pool.query(`INSERT INTO auctions(item_id,visibility,access_code_hash,starting_price,current_price,minimum_increment,start_time,end_time,status)
      VALUES($1,$2,$3,$4,$4,$5,clock_timestamp()+$6::interval,clock_timestamp()+$7::interval,$8) RETURNING *`,
    [listing.id, visibility, visibility === 'PRIVATE' ? privateHash : null, price, increment, start, end, status])).rows[0];
    if(visibility==='PRIVATE') await pool.query('UPDATE auctions SET access_code_lookup=$1 WHERE id=$2',[createHash('sha256').update('auction:'+accessCode).digest('hex'),result.id]);
    return { ...result, listing, owner, accessCode: visibility === 'PRIVATE' ? accessCode : null };
  }

  async function commitment(a, user = bidder, status = 'SUCCESS') {
    process.env.MOYASAR_SECRET_KEY='sk_test_LOCAL_QA_NOT_A_REAL_KEY';process.env.MOYASAR_PUBLISHABLE_KEY='pk_test_LOCAL_QA_NOT_A_REAL_KEY';
    const paymentId=randomUUID(),nonce=randomBytes(24).toString('hex');
    const row=(await pool.query(`INSERT INTO bid_commitments(auction_id,user_id,status,sandbox_reference,provider,payment_id,amount_minor,checkout_nonce,expires_at)
      VALUES($1,$2,$3,'LOCAL_QA_FIXTURE_NOT_BANK_VERIFIED','MOYASAR',$4,10000,$5,clock_timestamp()+interval '1 hour')
      ON CONFLICT(auction_id,user_id) DO UPDATE SET status=EXCLUDED.status,payment_id=EXCLUDED.payment_id,checkout_nonce=EXCLUDED.checkout_nonce RETURNING *`,[a.id,user.id,status,paymentId,nonce])).rows[0];
    payments.set(paymentId,{id:paymentId,status:status==='SUCCESS'?'authorized':status==='PENDING'?'initiated':'failed',amount:10000,currency:'SAR',source:{type:'creditcard'},metadata:{commitment_id:row.id,checkout_nonce:nonce}});
    return row;
  }
  async function grant(a, user = bidder) {
    await pool.query('INSERT INTO private_auction_access(auction_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [a.id, user.id]);
  }
  async function bid(a, amount = 1000, user = bidder, requestId = randomUUID()) {
    return api(`/auctions/${a.id}/bids`, { method: 'POST', token: user.token, body: { amount, requestId } });
  }
  async function state(a) {
    const value = (await pool.query(`SELECT a.current_price,a.status,
      (SELECT count(*)::int FROM bids WHERE auction_id=a.id) AS bid_count,
      (SELECT count(*)::int FROM auction_results WHERE auction_id=a.id) AS result_count
      FROM auctions a WHERE id=$1`, [a.id])).rows[0];
    return { ...value, current_price: Number(value.current_price) };
  }
  async function awaitBlocked(minimum = 1) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const count = (await control.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'", [schema])).rows[0].n;
      if (count >= minimum) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail(`Expected ${minimum} application transactions waiting for the controlled auction lock`);
  }
  async function lock(a) {
    const client = await control.connect();
    await client.query('BEGIN');
    await client.query(`SELECT id FROM "${schema}".auctions WHERE id=$1 FOR UPDATE`, [a.id]);
    return client;
  }
  async function shutdown() {
    globalThis.fetch=realFetch;
    await new Promise(resolve=>smtp.close(resolve));
    server.closeIdleConnections();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
    await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    await control.end();
    await rm(process.env.UPLOAD_DIR, { recursive:true, force:true });
  }
  return { emails, emailCode, payments, base, schema, control, pool, category, seller, bidder, bidder2, admin, account, api, item, auction, commitment, grant, bid, state, lock, awaitBlocked, shutdown };
}

export function expectError(response, status, code) {
  assert.equal(response.status, status, JSON.stringify(response.json));
  assert.equal(response.json.error.code, code);
  assert.equal('data' in response.json, false);
}

export function expectSqlCode(code) {
  return error => { assert.equal(error.code, code); return true; };
}

