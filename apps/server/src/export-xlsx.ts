import ExcelJS from 'exceljs';
import type { ExportTransaction } from '@payment-ledger/database';

const MONEY_FORMAT = '#,##0.00';

function rupees(paise: number): number {
  return Math.round(paise) / 100;
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF165DFF' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
}

function autoWidth(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function buildTransactionsWorkbook(
  items: ExportTransaction[],
  meta: { from?: string | undefined; to?: string | undefined }
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Payment Desk';
  workbook.created = new Date();

  const transactions = workbook.addWorksheet('Transactions');
  transactions.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Time', key: 'time', width: 10 },
    { header: 'Payee', key: 'payee', width: 28 },
    { header: 'Amount (INR)', key: 'amount', width: 16 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Method', key: 'method', width: 14 },
    { header: 'Note', key: 'note', width: 36 },
    { header: 'Source', key: 'source', width: 10 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Needs review', key: 'review', width: 12 }
  ];
  styleHeader(transactions);
  transactions.views = [{ state: 'frozen', ySplit: 1 }];

  for (const item of items) {
    const row = transactions.addRow({
      id: item.id,
      date: item.transactionDate,
      time: item.transactionTime,
      payee: item.payeeName,
      amount: rupees(item.amountPaise),
      category: item.categoryName ?? 'Uncategorised',
      method: item.paymentMethodName ?? 'Needs review',
      note: item.note ?? '',
      source: item.source,
      status: item.status,
      review: item.needsReview ? 'yes' : ''
    });
    row.getCell('amount').numFmt = MONEY_FORMAT;
    row.getCell('amount').alignment = { horizontal: 'right' };
    row.getCell('id').alignment = { horizontal: 'right' };
  }

  const lastDataRow = Math.max(transactions.rowCount, 1);
  if (items.length > 0) {
    const totalRow = transactions.addRow({ payee: 'TOTAL', amount: { formula: `SUM(E2:E${lastDataRow})` } });
    totalRow.font = { bold: true };
    totalRow.getCell('amount').numFmt = MONEY_FORMAT;
    totalRow.getCell('amount').alignment = { horizontal: 'right' };
  }
  transactions.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Breakdown', key: 'label', width: 30 },
    { header: 'Total (INR)', key: 'total', width: 18 },
    { header: 'Payments', key: 'count', width: 12 },
    { header: 'Share %', key: 'share', width: 10 }
  ];
  styleHeader(summary);

  const section = (title: string, column: string, entries: Array<{ label: string }>) => {
    if (entries.length === 0) return;
    const titleRow = summary.addRow({ label: title });
    titleRow.font = { bold: true, color: { argb: 'FF165DFF' } };
    for (const entry of entries) {
      const row = summary.addRow({
        label: entry.label,
        total: {
          formula: `SUMIF(Transactions!${column}:${column},"${String(entry.label).replaceAll('"', '""')}",Transactions!$E:$E)`
        },
        count: {
          formula: `COUNTIF(Transactions!${column}:${column},"${String(entry.label).replaceAll('"', '""')}")`
        }
      });
      row.getCell('total').numFmt = MONEY_FORMAT;
    }
  };

  const categories = [...new Set(items.map((item) => item.categoryName ?? 'Uncategorised'))];
  const methods = [...new Set(items.map((item) => item.paymentMethodName ?? 'Needs review'))];
  const payees = [...new Set(items.map((item) => item.payeeName))];
  section('By Category', 'F', categories.map((label) => ({ label })));
  section('By Method', 'G', methods.map((label) => ({ label })));
  section('By Payee', 'D', payees.map((label) => ({ label })));

  if (items.length > 0) {
    const grandTotal = summary.addRow({
      label: 'GRAND TOTAL',
      total: { formula: `SUM(Transactions!E:E)` }
    });
    grandTotal.font = { bold: true };
    grandTotal.getCell('total').numFmt = MONEY_FORMAT;
  }

  const review = workbook.addWorksheet('Review');
  review.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Payee', key: 'payee', width: 28 },
    { header: 'Amount (INR)', key: 'amount', width: 16 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Method', key: 'method', width: 14 }
  ];
  styleHeader(review);
  const pending = items.filter((item) => item.needsReview);
  if (pending.length === 0) {
    const row = review.addRow({ id: '', date: '', payee: 'Nothing needs review in this selection.' });
    row.font = { italic: true, color: { argb: 'FF667085' } };
  } else {
    for (const item of pending) {
      const row = review.addRow({
        id: item.id,
        date: item.transactionDate,
        payee: item.payeeName,
        amount: rupees(item.amountPaise),
        category: item.categoryName ?? 'Uncategorised',
        method: item.paymentMethodName ?? 'Needs review'
      });
      row.getCell('amount').numFmt = MONEY_FORMAT;
    }
  }
  autoWidth(review, [8, 12, 28, 16, 18, 14]);

  const info = workbook.addWorksheet('Info');
  info.getColumn(1).width = 18;
  info.getColumn(2).width = 40;
  info.addRow(['Exported at', new Date().toISOString()]);
  info.addRow(['Range from', meta.from ?? '(all time)']);
  info.addRow(['Range to', meta.to ?? '(all time)']);
  info.addRow(['Transactions', items.length]);
  info.addRow(['Posted', items.filter((item) => item.status === 'posted').length]);
  info.addRow(['Voided', items.filter((item) => item.status === 'voided').length]);
  info.addRow(['Needs review', pending.length]);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
