// نتأكد إن تهيئة القاعدة تنجح مرتين بدون تكرار البيانات.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {databaseUrl,databaseSkip,testDatabase} from './helpers/qa-fixtures.js';
import {ensureTestExtension} from './helpers/test-extension.js';

test('DB-07: setup creates a clean schema and repeats without duplicate tables or categories',
  {skip:databaseSkip}, async()=>{
    const base=testDatabase(databaseUrl);
    const control=new pg.Pool({connectionString:base.toString()});
    const schema='setup_'+randomBytes(8).toString('hex');
    try {
      await ensureTestExtension(control);
      await control.query('CREATE SCHEMA "'+schema+'"');
      const url=new URL(base);
      url.searchParams.set('options','-c search_path='+schema+',public');
      // نشغّل نفس أمر التهيئة مرتين داخل مساحة اختبار فاضية.
      for(let attempt=0;attempt<2;attempt++){
        const result=spawnSync(process.execPath,['scripts/setup-db.js'],{
          env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',timeout:30000,
        });
        assert.equal(result.status,0,result.stderr||result.stdout);
        const tables=(await control.query(
          "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE'",[schema])).rows[0].n;
        assert.equal(tables,10);
        const count=(await control.query('SELECT count(*)::int AS n FROM "'+schema+'".categories')).rows[0].n;
        assert.equal(count,5);
      }
    } finally {
      await control.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
      await control.end();
    }
});
