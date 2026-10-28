import Database from 'better-sqlite3';
import { resolveRuntimePaths } from '../packages/database/dist/index.js';

const paths = resolveRuntimePaths();
console.log('Target database path:', paths.databasePath);

const db = new Database(paths.databasePath);

// 1. Ensure categories and payment methods exist
const categories = [
  'Wages', 'Transport', 'Tools', 'Materials', 'Courier', 'Food & Refreshments',
  'Fuel', 'Equipment Rental', 'Utilities', 'Maintenance', 'Supplier', 'Uncategorised'
];
const methods = [
  { code: 'cash', name: 'Cash' },
  { code: 'upi', name: 'UPI' },
  { code: 'bank', name: 'Bank Transfer' },
  { code: 'cheque', name: 'Cheque' }
];

db.exec('BEGIN IMMEDIATE;');
try {
  for (const cat of categories) {
    db.prepare('INSERT OR IGNORE INTO categories (name, active) VALUES (?, 1)').run(cat);
  }
  for (const m of methods) {
    db.prepare('INSERT OR IGNORE INTO payment_methods (code, name, active) VALUES (?, ?, 1)').run(m.code, m.name);
  }

  // Clear existing transactions and payees for clean seed
  db.exec('DELETE FROM transaction_audit; DELETE FROM transactions; DELETE FROM payee_aliases; DELETE FROM payees; DELETE FROM app_settings;');

  const catRows = db.prepare('SELECT id, name FROM categories').all();
  const methodRows = db.prepare('SELECT id, code FROM payment_methods').all();
  const catMap = new Map(catRows.map(r => [r.name, r.id]));
  const methodMap = new Map(methodRows.map(r => [r.code, r.id]));

  const payeesData = [
    { name: 'Ramesh Kumar', type: 'person', cat: 'Wages', method: 'cash', favourite: 1, min: 650, max: 1800, aliases: ['ramesh'], notes: ['daily wages', 'overtime'] },
    { name: 'Mahesh Transport', type: 'company', cat: 'Transport', method: 'bank', favourite: 1, min: 2500, max: 18000, aliases: ['mahesh truck'], notes: ['material delivery', 'truck hire'] },
    { name: 'ABC Tools', type: 'company', cat: 'Tools', method: 'bank', favourite: 1, min: 1200, max: 24000, aliases: ['abc'], notes: ['drill bits', 'cutting discs'] },
    { name: 'Suresh Yadav', type: 'person', cat: 'Wages', method: 'cash', favourite: 0, min: 650, max: 1600, aliases: ['suresh'], notes: ['daily wages', 'loading work'] },
    { name: 'Imran Sheikh', type: 'person', cat: 'Wages', method: 'upi', favourite: 0, min: 700, max: 2200, aliases: ['imran'], notes: ['fabrication work'] },
    { name: 'Shree Ganesh Suppliers', type: 'company', cat: 'Supplier', method: 'bank', favourite: 0, min: 4500, max: 42000, aliases: ['ganesh supplier'], notes: ['monthly supplies'] },
    { name: 'Patel Steel Traders', type: 'company', cat: 'Materials', method: 'cheque', favourite: 1, min: 12000, max: 85000, aliases: ['patel steel'], notes: ['steel sections', 'sheet material'] },
    { name: 'Vijay Courier Service', type: 'company', cat: 'Courier', method: 'upi', favourite: 0, min: 180, max: 1800, aliases: ['vijay courier'], notes: ['parcel dispatch'] },
    { name: 'Lakshmi Electricals', type: 'company', cat: 'Materials', method: 'upi', favourite: 0, min: 800, max: 16000, aliases: ['lakshmi electric'], notes: ['cables and sockets'] },
    { name: 'Anil Verma', type: 'person', cat: 'Wages', method: 'cash', favourite: 0, min: 550, max: 1300, aliases: ['anil'], notes: ['helper wages'] },
    { name: 'City Crane Services', type: 'company', cat: 'Transport', method: 'bank', favourite: 0, min: 6500, max: 38000, aliases: ['city crane'], notes: ['crane hire'] },
    { name: 'Om Hardware Mart', type: 'company', cat: 'Tools', method: 'cash', favourite: 0, min: 500, max: 9500, aliases: ['om hardware'], notes: ['fasteners', 'workshop supplies'] }
  ];

  const insertPayee = db.prepare(`INSERT INTO payees
    (type, name, normalized_name, default_category_id, default_payment_method_id, active, notes, favourite)
    VALUES (?, ?, ?, ?, ?, 1, '[DEMO] Synthetic payee', ?)`);
  const insertAlias = db.prepare(`INSERT INTO payee_aliases (payee_id, alias, normalized_alias) VALUES (?, ?, ?)`);

  const payeeIds = new Map();
  for (const p of payeesData) {
    const res = insertPayee.run(p.type, p.name, p.name.toLowerCase(), catMap.get(p.cat), methodMap.get(p.method), p.favourite);
    const id = Number(res.lastInsertRowid);
    payeeIds.set(p.name, id);
    for (const a of p.aliases) {
      insertAlias.run(id, a, a.toLowerCase());
    }
  }

  const insertTx = db.prepare(`INSERT INTO transactions
    (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, note, source, status, needs_review, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'posted', ?, ?, ?)`);
  const insertAudit = db.prepare(`INSERT INTO transaction_audit
    (transaction_id, action, previous_data, new_data, changed_at, change_source)
    VALUES (?, 'created', NULL, ?, ?, 'web')`);

  let count = 0;
  let state = 0x5eed2026;
  function rnd() { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; }

  // Historical dates: Feb 1, 2026 to Aug 1, 2026
  const start = new Date('2026-02-01T00:00:00Z');
  const end = new Date('2026-08-01T00:00:00Z');

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const num = d.getUTCDay() === 0 ? 0 : d.getUTCDay() === 6 ? 2 : 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < num; i++) {
      const p = payeesData[Math.floor(rnd() * payeesData.length)];
      const amt = Math.round((p.min + rnd() * (p.max - p.min)) / 10) * 1000;
      const h = 8 + Math.floor(rnd() * 11);
      const m = Math.floor(rnd() * 60);
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      const review = rnd() < 0.03 ? 1 : 0;
      const ts = `${dateStr}T${timeStr}.000Z`;
      const note = `[DEMO] ${p.notes[Math.floor(rnd() * p.notes.length)]}`;
      const res = insertTx.run(dateStr, timeStr, payeeIds.get(p.name), amt, catMap.get(p.cat), methodMap.get(p.method), note, review, ts, ts);
      const id = Number(res.lastInsertRowid);
      insertAudit.run(id, JSON.stringify({ id, date: dateStr, amount: amt }), ts);
      count++;
    }
  }

  // Explicit Today transactions: 2026-08-02
  const todayStr = '2026-08-02';
  const todayTx = [
    { payee: 'Ramesh Kumar', amt: 120000, cat: 'Wages', method: 'cash', note: '[DEMO] Daily site labor wages', time: '10:15:00' },
    { payee: 'Mahesh Transport', amt: 450000, cat: 'Transport', method: 'bank', note: '[DEMO] Material delivery truck hire', time: '11:30:00' },
    { payee: 'ABC Tools', amt: 1800000, cat: 'Tools', method: 'bank', note: '[DEMO] Cutting discs and drill set', time: '13:45:00' },
    { payee: 'Suresh Yadav', amt: 200000, cat: 'Wages', method: 'cash', note: '[DEMO] Helper loading overtime', time: '14:20:00' },
    { payee: 'Patel Steel Traders', amt: 3000000, cat: 'Materials', method: 'cheque', note: '[DEMO] Steel plates advance payment', time: '15:10:00' }
  ];

  for (const t of todayTx) {
    const ts = `${todayStr}T${t.time}.000Z`;
    const res = insertTx.run(todayStr, t.time, payeeIds.get(t.payee), t.amt, catMap.get(t.cat), methodMap.get(t.method), t.note, 0, ts, ts);
    const id = Number(res.lastInsertRowid);
    insertAudit.run(id, JSON.stringify({ id, date: todayStr, amount: t.amt }), ts);
    count++;
  }

  db.exec('COMMIT;');
  console.log(`Successfully seeded ${payeesData.length} payees and ${count} transactions!`);
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Seeding error:', err);
} finally {
  db.close();
}
