import { describe, expect, it } from 'vitest';
import { normalizeLookupText, parseAmountTokenToPaise, parseQuickEntry } from './index.js';

describe('parseAmountTokenToPaise', () => {
  it.each([
    ['800', 80_000],
    ['2.5k', 250_000],
    ['12.5k', 1_250_000],
    ['1l', 10_000_000],
    ['1 lakh', 10_000_000],
    ['2.40lakh', 24_000_000],
    ['2,40lakh', 24_000_000],
    ['240 lakh', 2_400_000_000],
    ['0.75l', 7_500_000],
    ['1,000', 100_000]
  ])('parses %s exactly', (input, expected) => {
    expect(parseAmountTokenToPaise(input)).toBe(expected);
  });

  it.each(['', '0', '-5', '1.001', '2m', 'abc', '1.234567k'])('rejects %s', (input) => {
    expect(parseAmountTokenToPaise(input)).toBeNull();
  });
});

describe('normalizeLookupText', () => {
  it('normalizes case, punctuation and spacing deterministically', () => {
    expect(normalizeLookupText('  ABC   Tools & Co. ')).toBe('abc tools co');
  });
});

describe('new payee quick entry', () => {
  it('creates a deterministic review preview with cash as default', () => {
    const preview = parseQuickEntry('amit kumar 50l', {
      payees: [],
      categories: [],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['c', 'cash'] }]
    });
    expect(preview).toMatchObject({
      valid: true,
      payeeName: 'Amit Kumar',
      isNewPayee: true,
      amountPaise: 500_000_000,
      paymentMethodId: 1,
      needsReview: true
    });
  });
  it('does not mistake a 12-hour time or ISO date for another amount', () => {
    const preview = parseQuickEntry('amit kumar 800 yesterday 9:30am', {
      payees: [],
      categories: [],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] }]
    });
    expect(preview.amountPaise).toBe(80_000);
    expect(preview.errors).toEqual([]);
  });

  it('does not turn a longer new name into a partial alias match', () => {
    const preview = parseQuickEntry('abc bhai 2500 cash', {
      payees: [
        {
          id: 7,
          name: 'ABC Tools',
          normalizedNames: ['abc tools', 'abc'],
          defaultCategoryId: null,
          defaultPaymentMethodId: 1
        }
      ],
      categories: [],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['c', 'cash'] }]
    });
    expect(preview).toMatchObject({
      valid: true,
      payeeId: null,
      payeeName: 'Abc Bhai',
      isNewPayee: true,
      amountPaise: 250_000
    });
  });

  it('does not require review when a new payee has a category and cash default', () => {
    const preview = parseQuickEntry('amit kumar 3l wages', {
      payees: [],
      categories: [{ id: 8, name: 'Wages', normalizedNames: ['wages'] }],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] }]
    });
    expect(preview).toMatchObject({
      valid: true,
      payeeName: 'Amit Kumar',
      categoryId: 8,
      paymentMethodId: 1,
      needsReview: false
    });
  });

  it.each([
    ['sai metal 3l wages "upad na 300 cut"', 'upad na 300 cut'],
    ['sai metal 3l wages // upad na 300 cut', 'upad na 300 cut']
  ])('keeps an explicit note separate for %s', (command, note) => {
    const preview = parseQuickEntry(command, {
      payees: [],
      categories: [{ id: 8, name: 'Wages', normalizedNames: ['wages'] }],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] }]
    });
    expect(preview).toMatchObject({
      valid: true,
      payeeName: 'Sai Metal',
      amountPaise: 30_000_000,
      categoryId: 8,
      paymentMethodId: 1,
      note,
      needsReview: false
    });
  });
});

describe('known payee defaults', () => {
  it('uses the payee category but keeps cash as the desk-wide default method', () => {
    const preview = parseQuickEntry('vijay patel 2500', {
      payees: [{
        id: 2,
        name: 'Vijay Patel',
        normalizedNames: ['vijay patel'],
        defaultCategoryId: 8,
        defaultPaymentMethodId: 3
      }],
      categories: [{ id: 8, name: 'Subcontractors', normalizedNames: ['subcontractors'] }],
      paymentMethods: [
        { id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] },
        { id: 3, code: 'upi', displayName: 'UPI', aliases: ['upi'] }
      ]
    });
    expect(preview).toMatchObject({
      valid: true,
      categoryId: 8,
      paymentMethodId: 1,
      needsReview: false
    });
  });

  it('allows an explicit category word to override the payee default', () => {
    const preview = parseQuickEntry('suresh yadav 3l material', {
      payees: [{
        id: 4,
        name: 'Suresh Yadav',
        normalizedNames: ['suresh yadav'],
        defaultCategoryId: 1,
        defaultPaymentMethodId: 1
      }],
      categories: [
        { id: 1, name: 'Wages', normalizedNames: ['wages', 'wage'] },
        { id: 2, name: 'Materials', normalizedNames: ['materials', 'material'] }
      ],
      paymentMethods: [{ id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] }]
    });
    expect(preview).toMatchObject({
      valid: true,
      amountPaise: 30_000_000,
      categoryId: 2,
      categoryName: 'Materials',
      needsReview: false
    });
  });

  it('strips a leading test keyword and flags the preview as a dry run', () => {
    const preview = parseQuickEntry('test ramesh 800', baseContext);
    expect(preview).toMatchObject({
      valid: true,
      test: true,
      silent: false,
      payeeName: 'Ramesh Kumar',
      amountPaise: 80_000
    });
    expect(preview.warnings.some((warning) => warning.includes('TEST'))).toBe(true);
  });

  it('strips a leading silent keyword and flags telegram suppression', () => {
    const preview = parseQuickEntry('silent suresh 500 upi', baseContext);
    expect(preview).toMatchObject({
      valid: true,
      test: false,
      silent: true,
      payeeName: 'Suresh Yadav',
      paymentMethodId: 2,
      amountPaise: 50_000
    });
  });

  it('supports combined mode keywords and leaves mid-command words alone', () => {
    const combined = parseQuickEntry('test silent mahesh 2.5k transport', baseContext);
    expect(combined).toMatchObject({ test: true, silent: true, amountPaise: 250_000 });

    // "test" not at the start is treated as normal text (payee/note), not a mode flag
    const mid = parseQuickEntry('ramesh 800 test', baseContext);
    expect(mid.test).toBe(false);
  });
});

const baseContext = {
  payees: [
    {
      id: 1,
      name: 'Ramesh Kumar',
      normalizedNames: ['ramesh kumar', 'ramesh'],
      defaultCategoryId: 1,
      defaultPaymentMethodId: 1
    },
    {
      id: 2,
      name: 'Suresh Yadav',
      normalizedNames: ['suresh yadav', 'suresh'],
      defaultCategoryId: 1,
      defaultPaymentMethodId: 1
    },
    {
      id: 3,
      name: 'Mahesh Transport',
      normalizedNames: ['mahesh transport', 'mahesh'],
      defaultCategoryId: 2,
      defaultPaymentMethodId: 3
    }
  ],
  categories: [
    { id: 1, name: 'Wages', normalizedNames: ['wages', 'wage'] },
    { id: 2, name: 'Transport', normalizedNames: ['transport'] }
  ],
  paymentMethods: [
    { id: 1, code: 'cash', displayName: 'Cash', aliases: ['cash'] },
    { id: 2, code: 'upi', displayName: 'UPI', aliases: ['upi'] },
    { id: 3, code: 'bank', displayName: 'Bank transfer', aliases: ['bank'] }
  ]
};
