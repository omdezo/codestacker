/**
 * Audit log pagination benchmark — offset vs keyset (cursor).
 *
 * Usage (API must be running on PORT):
 *   node scripts/bench-audit.js
 */

'use strict';

require('dotenv').config();

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const AUTH = 'Basic ' + Buffer.from('admin@flowcare.com:Admin@1234').toString('base64');
const RUNS = 5;
const SIZE = 20;

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  return res.json();
}

async function bench(label, path) {
  await get(path); // warmup
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now();
    await get(path);
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const p95 = times[Math.ceil(times.length * 0.95) - 1] ?? times[times.length - 1];
  console.log(`  ${label.padEnd(44)} avg=${String(avg).padStart(5)}ms   p95=${String(p95).padStart(5)}ms`);
  return { avg, p95 };
}

async function main() {
  console.log('\n=== FlowCare Audit Log Pagination Benchmark ===\n');

  const first = await get(`/api/audit-logs?page=1&size=1`);
  console.log(`Total audit logs in DB: ${first.total?.toLocaleString() ?? 'unknown'}\n`);

  // ── 1. OFFSET PAGINATION ───────────────────────────────────────────────────
  console.log('[ OFFSET ]  GET /api/audit-logs?page=N&size=20\n');
  const off = {};
  off[1]     = await bench('page=1      (OFFSET 0)',        `/api/audit-logs?page=1&size=${SIZE}`);
  off[100]   = await bench('page=100    (OFFSET 1,980)',    `/api/audit-logs?page=100&size=${SIZE}`);
  off[500]   = await bench('page=500    (OFFSET 9,980)',    `/api/audit-logs?page=500&size=${SIZE}`);
  off[1000]  = await bench('page=1000   (OFFSET 19,980)',   `/api/audit-logs?page=1000&size=${SIZE}`);
  off[5000]  = await bench('page=5000   (OFFSET 99,980)',   `/api/audit-logs?page=5000&size=${SIZE}`);
  off[10000] = await bench('page=10000  (OFFSET 199,980)',  `/api/audit-logs?page=10000&size=${SIZE}`);
  off[25000] = await bench('page=25000  (OFFSET 499,980)',  `/api/audit-logs?page=25000&size=${SIZE}`);
  off[50000] = await bench('page=50000  (OFFSET 999,980)',  `/api/audit-logs?page=50000&size=${SIZE}`);

  // ── 2. GET DEEP CURSORS (afterDate + afterId from offset results) ─────────
  console.log('\n  (collecting keyset cursors from offset results…)');

  // Fetch the record at the top (page 1) and bottom (page 50,000)
  const page1Data   = await get(`/api/audit-logs?page=1&size=${SIZE}`);
  const page50kData = await get(`/api/audit-logs?page=50000&size=${SIZE}`);

  const topRecord    = page1Data.results?.[SIZE - 1];    // last of page 1
  const bottomRecord = page50kData.results?.[0];          // first of page 50,000

  const topCursor    = topRecord    ? `afterDate=${encodeURIComponent(topRecord.createdAt)}&afterId=${topRecord.id}`       : '';
  const bottomCursor = bottomRecord ? `afterDate=${encodeURIComponent(bottomRecord.createdAt)}&afterId=${bottomRecord.id}` : '';

  // ── 3. KEYSET (CURSOR) PAGINATION ─────────────────────────────────────────
  console.log('\n[ CURSOR ]  GET /api/audit-logs/cursor?afterDate=X&afterId=Y&size=20\n');
  console.log('  (Uses WHERE createdAt < pivot via B-tree index — O(log n) at any depth)\n');
  const cur = {};
  cur.top    = await bench('first page  (no cursor)',          `/api/audit-logs/cursor?size=${SIZE}`);
  cur.page2  = await bench('page~2      (cursor near top)',    `/api/audit-logs/cursor?size=${SIZE}&${topCursor}`);
  cur.bottom = await bench('page~50000  (cursor near bottom)', `/api/audit-logs/cursor?size=${SIZE}&${bottomCursor}`);

  // ── 4. COMPARISON SUMMARY ─────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  RESULT  (avg response time, 1,000,000 rows)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ${'Depth'.padEnd(32)} ${'OFFSET'.padStart(8)}   ${'CURSOR'.padStart(8)}`);
  console.log(`  ${'─'.repeat(56)}`);
  console.log(`  ${'Top of table (page 1)'.padEnd(32)} ${String(off[1].avg     + 'ms').padStart(8)}   ${String(cur.top.avg  + 'ms').padStart(8)}`);
  console.log(`  ${'Bottom (page 50,000)'.padEnd(32)}  ${String(off[50000].avg + 'ms').padStart(8)}   ${String(cur.bottom.avg + 'ms').padStart(8)}`);
  console.log(`  ${'─'.repeat(56)}`);

  const speedup = (off[50000].avg / cur.bottom.avg).toFixed(1);
  const offDeg  = (off[50000].avg / off[1].avg).toFixed(1);
  const curDeg  = (cur.bottom.avg / cur.top.avg).toFixed(1);
  console.log(`  Offset degraded ${offDeg}x from page 1 → page 50,000`);
  console.log(`  Cursor degraded ${curDeg}x  (effectively flat)`);
  console.log(`  Cursor is ${speedup}x faster than offset at max depth\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
