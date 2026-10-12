// Disposable PostgreSQL-WASM rehearsal only; never connects to a provider database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Supply the absolute path to a separately installed @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const migration = await readFile(new URL('../../prisma/migrations/20261011210000_sentinel_security_core/migration.sql', import.meta.url), 'utf8');
const checks = [];
let db = await PGlite.create();
let restored;
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
async function rejectsSql(sql, code) { await assert.rejects(() => db.exec(sql), error => error.code === code); }
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE sentinel_lab_reader;');
  await check('exact Sentinel migration applies', () => db.exec(migration));
  await check('all tables have RLS enabled', async () => {
    const r = await db.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('sentinel_collectors','sentinel_nonces','sentinel_security_events') ORDER BY relname");
    assert.equal(r.rows.length, 3); assert.ok(r.rows.every(row => row.relrowsecurity));
  });
  for (const role of ['anon', 'authenticated']) {
    await check(role + ' cannot read Sentinel tables', async () => {
      const r = await db.query("SELECT has_table_privilege($1,'sentinel_collectors','SELECT') AS c, has_table_privilege($1,'sentinel_nonces','SELECT') AS n, has_table_privilege($1,'sentinel_security_events','SELECT') AS e", [role]);
      assert.deepEqual(r.rows[0], {c:false,n:false,e:false});
    });
  }
  await db.exec(`INSERT INTO sentinel_collectors (id,"tenantId",source,label,"keyHash","consentReference","expiresAt","updatedAt") VALUES
    ('collector_a','tenant_a','wazuh','Lab A','hash_a','lab-consent-a',CURRENT_TIMESTAMP + interval '1 day',CURRENT_TIMESTAMP),
    ('collector_b','tenant_b','wazuh','Lab B','hash_b','lab-consent-b',CURRENT_TIMESTAMP + interval '1 day',CURRENT_TIMESTAMP);`);
  await check('new collectors are disabled', async () => {
    const r=await db.query('SELECT enabled,"consentVerifiedAt" FROM sentinel_collectors');
    assert.ok(r.rows.every(row=>row.enabled===false && row.consentVerifiedAt===null));
  });
  await check('unique collector credential hashes enforced', () => rejectsSql(`INSERT INTO sentinel_collectors (id,"tenantId",source,label,"keyHash","consentReference","expiresAt","updatedAt") VALUES ('collector_c','tenant_c','wazuh','Lab C','hash_a','lab-consent-c',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, '23505'));
  await db.exec(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('nonce_a','collector_a','replay_nonce_a');`);
  await check('same collector nonce replay rejected', () => rejectsSql(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('nonce_replay','collector_a','replay_nonce_a')`, '23505'));
  await check('different collectors may use same nonce', () => db.exec(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('nonce_b','collector_b','replay_nonce_a')`));
  await check('unknown collector nonce rejected', () => rejectsSql(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('nonce_unknown','missing','other_nonce')`, '23503'));
  const insertEvent = (id,collector,tenant) => db.exec(`INSERT INTO sentinel_security_events (id,"collectorId","tenantId",source,"sourceEventId",severity,title,description,"occurredAt") VALUES ('${id}','${collector}','${tenant}','wazuh','same_source_event','high','LAB ONLY','synthetic migration rehearsal',CURRENT_TIMESTAMP)`);
  await insertEvent('event_a','collector_a','tenant_a');
  await check('duplicate source event within tenant rejected', () => assert.rejects(()=>insertEvent('event_duplicate','collector_a','tenant_a'),error=>error.code==='23505'));
  await check('same source event in separate tenant preserved', () => insertEvent('event_b','collector_b','tenant_b'));
  await check('default incident lifecycle is triage pending', async()=>{
    const r=await db.query('SELECT state FROM sentinel_security_events'); assert.ok(r.rows.every(row=>row.state==='triage_pending'));
  });
  await check('unprivileged server role fails closed without policy', async()=>{
    await db.exec('GRANT SELECT ON sentinel_security_events TO sentinel_lab_reader; SET ROLE sentinel_lab_reader;');
    try {const r=await db.query('SELECT id FROM sentinel_security_events');assert.equal(r.rows.length,0);}
    finally {await db.exec('RESET ROLE');}
  });
  await check('collectors with incident evidence cannot be deleted', () => rejectsSql("DELETE FROM sentinel_collectors WHERE id='collector_a'", '23503'));
  await check('failed transaction rolls back its nonce', async()=>{
    await assert.rejects(()=>db.transaction(async tx=>{
      await tx.exec(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('rolled_back','collector_a','rollback_nonce')`);
      throw new Error('lab rollback');
    }), /lab rollback/);
    const r=await db.query("SELECT id FROM sentinel_nonces WHERE id='rolled_back'");assert.equal(r.rows.length,0);
  });
  const snapshot=await db.dumpDataDir('none');
  await db.close(); db=null;
  restored=await PGlite.create({loadDataDir:snapshot});
  await check('backup restores both tenants and replay evidence', async()=>{
    const r=await restored.query('SELECT "tenantId" FROM sentinel_security_events ORDER BY "tenantId"');
    assert.deepEqual(r.rows,[{tenantId:'tenant_a'},{tenantId:'tenant_b'}]);
    const n=await restored.query('SELECT count(*)::integer AS n FROM sentinel_nonces');assert.equal(n.rows[0].n,2);
    const c=await restored.query('SELECT count(*)::integer AS n FROM sentinel_collectors');assert.equal(c.rows[0].n,2);
  });
  await check('restored database still rejects replay', ()=>assert.rejects(()=>restored.exec(`INSERT INTO sentinel_nonces (id,"collectorId",nonce) VALUES ('restore_replay','collector_a','replay_nonce_a')`),error=>error.code==='23505'));
  console.log(JSON.stringify({status:'PASS',checks:checks.length,migrationSha256:createHash('sha256').update(migration).digest('hex'),scope:'Disposable PGlite PostgreSQL-WASM; not provider backup, HTTP API, or production readiness'},null,2));
} finally { if(db)await db.close(); if(restored)await restored.close(); }
