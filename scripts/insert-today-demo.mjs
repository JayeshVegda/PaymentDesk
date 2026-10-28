import { openDatabase } from '../packages/database/dist/index.js';

const runtime = openDatabase({ migrate: true });
const db = runtime.sqlite;
const today = '2026-08-02';
const now = new Date().toISOString();

const payees = db.prepare('SELECT id, name FROM payees LIMIT 5').all();
const categories = db.prepare('SELECT id, name FROM categories LIMIT 5').all();
const methods = db.prepare('SELECT id, code FROM payment_methods LIMIT 5').all();

console.log('Payees:', payees);
console.log('Categories:', categories);
console.log('Methods:', methods);

if (payees.length && categories.length && methods.length) {
  const insertTx = db.prepare(`INSERT INTO transactions 
    (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, note, source, status, needs_review, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'posted', 0, ?, ?)`);

  const insertAudit = db.prepare(`INSERT INTO transaction_audit
    (transaction_id, action, previous_data, new_data, changed_at, change_source)
    VALUES (?, 'created', NULL, ?, ?, 'web')`);

  const dummyToday = [
    { payeeId: payees[0].id, amount: 120000, catId: categories[0].id, methodId: methods[0].id, note: '[DEMO] Daily site labor wages', time: '10:15:00' },
    { payeeId: payees[1 % payees.length].id, amount: 450000, catId: categories[1 % categories.length].id, methodId: methods[1 % methods.length].id, note: '[DEMO] Material delivery truck hire', time: '11:30:00' },
    { payeeId: payees[2 % payees.length].id, amount: 1800000, catId: categories[2 % categories.length].id, methodId: methods[1 % methods.length].id, note: '[DEMO] Cutting discs and drill set', time: '13:45:00' },
    { payeeId: payees[3 % payees.length].id, amount: 200000, catId: categories[0].id, methodId: methods[0].id, note: '[DEMO] Helper loading overtime', time: '14:20:00' },
    { payeeId: payees[4 % payees.length].id, amount: 3000000, catId: categories[3 % categories.length].id, methodId: methods[2 % methods.length].id, note: '[DEMO] Steel plates advance payment', time: '15:10:00' }
  ];

  for (const tx of dummyToday) {
    const result = insertTx.run(today, tx.time, tx.payeeId, tx.amount, tx.catId, tx.methodId, tx.note, now, now);
    const id = Number(result.lastInsertRowid);
    insertAudit.run(id, JSON.stringify({ id, date: today, amount: tx.amount }), now);
  }
  console.log('Inserted 5 transactions for today successfully!');
}

await runtime.close();
