import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from '../packages/database/dist/index.js';

// Safety: never seed the real database. Force an isolated sandbox directory
// unless PAYMENT_LEDGER_DATA_DIR already points somewhere custom.
const productionRoot = join(process.env.LOCALAPPDATA ?? '', 'PaymentLedger');
const configured = process.env.PAYMENT_LEDGER_DATA_DIR?.trim();
let sandboxDir: string | null = null;
if (!configured || resolve(configured) === resolve(productionRoot)) {
  sandboxDir = mkdtempSync(join(tmpdir(), 'payment-ledger-seed-'));
  process.env.PAYMENT_LEDGER_DATA_DIR = sandboxDir;
}

const runtime = openDatabase({ migrate: true });
const db = runtime.sqlite;

const firstNames = [
  'Ramesh', 'Suresh', 'Mahesh', 'Anil', 'Vijay', 'Sanjay', 'Rajesh', 'Sunil', 'Amit', 'Rahul',
  'Vikram', 'Dinesh', 'Karan', 'Arjun', 'Imran', 'Vinay', 'Harish', 'Manish', 'Alok', 'Ajay',
  'Deepak', 'Sandeep', 'Pradeep', 'Manoj', 'Pankaj', 'Abhishek', 'Gaurav', 'Nitin', 'Rohit', 'Sumit'
];

const lastNames = [
  'Kumar', 'Yadav', 'Verma', 'Sharma', 'Patel', 'Shah', 'Singh', 'Gupta', 'Joshi', 'Mehta',
  'Mishra', 'Trivedi', 'Jha', 'Choudhary', 'Reddy', 'Nair', 'Pillai', 'Rao', 'Shinde', 'Jadhav'
];

const companyNames = [
  'Mahesh Transport', 'ABC Tools', 'Shree Ganesh Suppliers', 'Patel Steel Traders',
  'Vijay Courier Service', 'Lakshmi Electricals', 'City Crane Services', 'Om Hardware Mart',
  'Balaji Cement Supply', 'National Sand Agency', 'Apex Machinery Corp', 'Metro Brick Industries',
  'Super Hydraulic Works', 'Hind Stone Crushers', 'Royal Paints & Chemicals', 'Dynamic Earthmovers',
  'Ganga Water Supply', 'Navbharat Timber Mart', 'Vikas Fuel Station', 'Maruti Spares & Tyres'
];

const notesByCategory: Record<string, string[]> = {
  Wages: ['helper wages', 'daily wages', 'overtime pay', 'weekly wages', 'site wages'],
  Transport: ['truck hire', 'material delivery', 'diesel advance', 'loading charge', 'freight fee'],
  Tools: ['drill bits', 'cutting discs', 'hand tools', 'safety gear', 'workshop supplies'],
  Supplier: ['monthly supplies', 'consumables', 'hardware stock', 'stationery stock'],
  Materials: ['steel sections', 'sand supply', 'cement bags', 'aggregate delivery', 'bricks purchase'],
  Courier: ['parcel dispatch', 'urgent documents', 'spare parts courier', 'bill courier'],
  Subcontractors: ['fabrication contract', 'site advance', 'labour settlement', 'civil contract'],
  'Office & Admin': ['office printing', 'tea and snacks', 'internet recharge', 'cleaning supplies'],
  'Equipment Hire': ['crane hire', 'mixer machine rental', 'scaffolding hire', 'generator rental'],
  Fuel: ['diesel for generator', 'fuel for pickup', 'lubricant oil', 'petrol reimbursement'],
  'Repairs & Maintenance': ['welding machine repair', 'truck servicing', 'drill machine repair', 'electrical fix'],
  'Sundry Expenses': ['petty cash replenishment', 'miscellaneous purchase', 'site refreshment']
};

const methods = ['cash', 'upi', 'bank', 'cheque'];

type DemoPayee = {
  name: string;
  type: 'person' | 'company';
  category: string;
  method: string;
  favourite: boolean;
  aliases: string[];
  notes: string[];
  minimumRupees: number;
  maximumRupees: number;
};

// Generate 80 random payees
const payees: DemoPayee[] = [];

// Add the original 14 payees first to keep tests compatible
const originalPayees: DemoPayee[] = [
  {
    name: 'Ramesh Kumar',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    favourite: true,
    aliases: ['ramesh'],
    notes: notesByCategory['Wages']!,
    minimumRupees: 650,
    maximumRupees: 1800
  },
  {
    name: 'Mahesh Transport',
    type: 'company',
    category: 'Transport',
    method: 'bank',
    favourite: true,
    aliases: ['mahesh', 'mahesh truck'],
    notes: notesByCategory['Transport']!,
    minimumRupees: 2500,
    maximumRupees: 18000
  },
  {
    name: 'ABC Tools',
    type: 'company',
    category: 'Tools',
    method: 'bank',
    favourite: true,
    aliases: ['abc'],
    notes: notesByCategory['Tools']!,
    minimumRupees: 1200,
    maximumRupees: 24000
  },
  {
    name: 'Suresh Yadav',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    favourite: false,
    aliases: ['suresh'],
    notes: notesByCategory['Wages']!,
    minimumRupees: 650,
    maximumRupees: 1600
  },
  {
    name: 'Imran Sheikh',
    type: 'person',
    category: 'Wages',
    method: 'upi',
    favourite: false,
    aliases: ['imran'],
    notes: notesByCategory['Wages']!,
    minimumRupees: 700,
    maximumRupees: 2200
  },
  {
    name: 'Shree Ganesh Suppliers',
    type: 'company',
    category: 'Raw Material',
    method: 'bank',
    favourite: false,
    aliases: ['ganesh supplier'],
    notes: notesByCategory['Supplier']!,
    minimumRupees: 4500,
    maximumRupees: 42000
  },
  {
    name: 'Patel Steel Traders',
    type: 'company',
    category: 'Raw Material',
    method: 'cheque',
    favourite: true,
    aliases: ['patel steel'],
    notes: notesByCategory['Materials']!,
    minimumRupees: 12000,
    maximumRupees: 85000
  },
  {
    name: 'Vijay Courier Service',
    type: 'company',
    category: 'Transport',
    method: 'upi',
    favourite: false,
    aliases: ['vijay courier'],
    notes: notesByCategory['Courier']!,
    minimumRupees: 180,
    maximumRupees: 1800
  },
  {
    name: 'Vijay Patel',
    type: 'person',
    category: 'Outside Work',
    method: 'upi',
    favourite: true,
    aliases: ['vijaybhai', 'vijay p'],
    notes: notesByCategory['Subcontractors']!,
    minimumRupees: 1500,
    maximumRupees: 18000
  },
  {
    name: 'Vinay Shah',
    type: 'person',
    category: 'Office Expense',
    method: 'upi',
    favourite: false,
    aliases: ['vinay', 'v shah'],
    notes: notesByCategory['Office & Admin']!,
    minimumRupees: 300,
    maximumRupees: 6500
  },
  {
    name: 'Lakshmi Electricals',
    type: 'company',
    category: 'Raw Material',
    method: 'upi',
    favourite: false,
    aliases: ['lakshmi electric'],
    notes: notesByCategory['Materials']!,
    minimumRupees: 800,
    maximumRupees: 16000
  },
  {
    name: 'Anil Verma',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    favourite: false,
    aliases: ['anil'],
    notes: notesByCategory['Wages']!,
    minimumRupees: 550,
    maximumRupees: 1300
  },
  {
    name: 'City Crane Services',
    type: 'company',
    category: 'Transport',
    method: 'bank',
    favourite: false,
    aliases: ['city crane'],
    notes: notesByCategory['Transport']!,
    minimumRupees: 6500,
    maximumRupees: 38000
  },
  {
    name: 'Om Hardware Mart',
    type: 'company',
    category: 'Tools',
    method: 'cash',
    favourite: false,
    aliases: ['om hardware'],
    notes: notesByCategory['Tools']!,
    minimumRupees: 500,
    maximumRupees: 9500
  }
];

payees.push(...originalPayees);

const usedAliases = new Set<string>();
for (const p of originalPayees) {
  for (const alias of p.aliases ?? []) {
    usedAliases.add(alias.toLowerCase());
  }
}

let state = 0xbeef2026;
function random(): number {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 0x100000000;
}
function pick<T>(values: T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

// Generate additional unique persons
const generatedPersonNames = new Set<string>(originalPayees.filter(p => p.type === 'person').map(p => p.name));
while (generatedPersonNames.size < 40) {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  if (!generatedPersonNames.has(name)) {
    generatedPersonNames.add(name);
    const cat = pick(['Wages', 'Subcontractors', 'Office & Admin']);
    const method = pick(methods);
    const alias = name.split(' ')[0]!.toLowerCase();
    const aliases = usedAliases.has(alias) ? [] : [alias];
    if (aliases.length > 0) {
      usedAliases.add(alias);
    }
    payees.push({
      name,
      type: 'person',
      category: cat,
      method,
      favourite: random() < 0.15,
      aliases,
      notes: notesByCategory[cat]!,
      minimumRupees: cat === 'Wages' ? 500 : cat === 'Subcontractors' ? 2000 : 200,
      maximumRupees: cat === 'Wages' ? 2000 : cat === 'Subcontractors' ? 25000 : 8000
    });
  }
}

// Generate additional unique companies
const generatedCompanyNames = new Set<string>(originalPayees.filter(p => p.type === 'company').map(p => p.name));
while (generatedCompanyNames.size < 18) {
  const name = pick(companyNames);
  if (!generatedCompanyNames.has(name)) {
    generatedCompanyNames.add(name);
    const cat = pick(['Transport', 'Tools', 'Supplier', 'Materials']);
    const method = pick(methods);
    const alias = name.split(' ')[0]!.toLowerCase();
    const aliases = usedAliases.has(alias) ? [] : [alias];
    if (aliases.length > 0) {
      usedAliases.add(alias);
    }
    payees.push({
      name,
      type: 'company',
      category: cat,
      method,
      favourite: random() < 0.15,
      aliases,
      notes: notesByCategory[cat]!,
      minimumRupees: 1000,
      maximumRupees: 50000
    });
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function timestamp(date: string, time: string): string {
  return `${date}T${time}.000Z`;
}

try {

  const categoryRows = db.prepare('SELECT id, name FROM categories').all() as Array<{
    id: number;
    name: string;
  }>;
  const methodRows = db.prepare('SELECT id, code FROM payment_methods').all() as Array<{
    id: number;
    code: string;
  }>;
  const categoryIds = new Map(categoryRows.map((row) => [row.name, row.id]));
  const methodIds = new Map(methodRows.map((row) => [row.code, row.id]));

  const seed = db.transaction(() => {
    const insertPayee = db.prepare(`INSERT INTO payees
      (type, name, normalized_name, default_category_id, default_payment_method_id, active, notes, favourite)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`);
    const insertAlias = db.prepare(
      'INSERT INTO payee_aliases (payee_id, alias, normalized_alias) VALUES (?, ?, ?)'
    );
    const payeeIds = new Map<string, number>();

    for (const payee of payees) {
      const result = insertPayee.run(
        payee.type,
        payee.name,
        payee.name.toLocaleLowerCase('en-IN'),
        categoryIds.get(payee.category),
        methodIds.get(payee.method),
        `[DEMO] Synthetic payee for local testing`,
        payee.favourite ? 1 : 0
      );
      const id = Number(result.lastInsertRowid);
      payeeIds.set(payee.name, id);
      for (const alias of payee.aliases ?? []) {
        insertAlias.run(id, alias, alias.toLocaleLowerCase('en-IN'));
      }
    }

    const insertTransaction = db.prepare(`INSERT INTO transactions
      (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id,
       note, source, status, needs_review, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'import', 'posted', ?, ?, ?)`);
    const insertAudit = db.prepare(`INSERT INTO transaction_audit
      (transaction_id, action, previous_data, new_data, changed_at, change_source)
      VALUES (?, 'created', NULL, ?, ?, 'import')`);
      
    let transactionCount = 0;
    let reviewCount = 0;
    let totalPaise = 0;
    
    const start = new Date('2025-12-01T00:00:00Z');
    const end = new Date('2026-08-02T00:00:00Z');
    let current = start.getTime();
    const endTime = end.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    while (current <= endTime) {
      const day = new Date(current);
      const date = isoDate(day);
      const weekday = day.getUTCDay();
      const isToday = date === '2026-08-02';
      
      // Calculate how many transactions per day (Sundays have fewer, weekdays have more)
      if (isToday) {
        count = 8;
      } else if (weekday === 0) {
        count = random() < 0.2 ? 1 : 0; // Occasionally 1 on Sunday
      } else if (weekday === 6) {
        count = Math.floor(random() * 4) + 1; // 1-4 on Saturdays
      } else {
        count = Math.floor(random() * 6) + 4; // 4-9 on weekdays
      }
      
      for (let index = 0; index < count; index += 1) {
        const payee = pick(payees);
        const wholeRupees =
          Math.round(
            (payee.minimumRupees + random() * (payee.maximumRupees - payee.minimumRupees)) / 10
          ) * 10;
        const amountPaise = wholeRupees * 100;
        const hour = 8 + Math.floor(random() * 11);
        const minute = Math.floor(random() * 60);
        const second = Math.floor(random() * 60);
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        
        // Approx 2% of transactions need review
        const needsReview = random() < 0.02 ? 1 : 0;
        const createdAt = timestamp(date, time);
        const note = `[DEMO] ${pick(payee.notes)}`;
        const methodId = methodIds.get(payee.method)!;
        
        const result = insertTransaction.run(
          date,
          time,
          payeeIds.get(payee.name),
          amountPaise,
          categoryIds.get(payee.category),
          methodId,
          note,
          needsReview,
          createdAt,
          createdAt
        );
        const id = Number(result.lastInsertRowid);
        insertAudit.run(
          id,
          JSON.stringify({
            id,
            transaction_date: date,
            transaction_time: time,
            payee: payee.name,
            amount_paise: amountPaise,
            category: payee.category,
            payment_method: payee.method,
            note,
            source: 'import',
            status: 'posted',
            needs_review: needsReview
          }),
          createdAt
        );
        transactionCount += 1;
        reviewCount += needsReview;
        totalPaise += amountPaise;
      }
      current += oneDay;
    }

    return {
      payees: payees.length,
      transactions: transactionCount,
      reviews: reviewCount,
      total_paise: totalPaise
    };
  });

  const result = seed();
  process.stdout.write(
    `${JSON.stringify({ status: 'ok', sandbox: runtime.paths.dataDir, ...result })}\n`
  );
} finally {
  await runtime.close();
  if (sandboxDir) rmSync(sandboxDir, { recursive: true, force: true, maxRetries: 5 });
}