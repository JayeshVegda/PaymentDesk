export interface Payee {
  id: number;
  type: 'person' | 'company';
  name: string;
  defaultCategoryId: number | null;
  defaultPaymentMethodId: number | null;
  active: boolean;
  favourite: boolean;
  notes: string | null;
  aliases: string[];
  paymentCount: number;
  totalPaidPaise: number;
  thisMonthPaidPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  active: boolean;
  sortOrder: number;
  note: string;
  aliases: string[];
}

export interface PaymentMethod {
  id: number;
  code: string;
  displayName: string;
  active: boolean;
}

export interface MasterData {
  payees: Payee[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
}

export interface LedgerTransaction {
  id: number;
  transactionDate: string;
  transactionTime: string;
  payeeId: number;
  payeeName: string;
  amountPaise: number;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  source: string;
  status: 'posted' | 'voided';
  needsReview: boolean;
  silent: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface QuickPreview {
  command: string;
  valid: boolean;
  payeeId: number | null;
  payeeName: string | null;
  isNewPayee: boolean;
  amountPaise: number | null;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  note: string | null;
  needsReview: boolean;
  test: boolean;
  silent: boolean;
  errors: string[];
  warnings: string[];
}

export interface QuickSaveResult {
  testRun: boolean;
  transaction: LedgerTransaction | null;
  duplicate: boolean;
  duplicateReason: string | null;
  createdPayee: boolean;
}

export interface DashboardData {
  date: string;
  totalOutgoingPaise: number;
  paymentCount: number;
  cashPaise: number;
  digitalPaise: number;
  reviewCount: number;
  uniquePayeeCount: number;
  largestPaymentPaise: number;
  monthTotalPaise: number;
  previousMonthTotalPaise: number;
  averageActiveDayPaise: number;
  recent: LedgerTransaction[];
  frequent: Array<{
    id: number;
    name: string;
    type: string;
    favourite: number;
    paymentCount: number;
    totalPaidPaise: number;
  }>;
}

export interface TransactionPage {
  items: LedgerTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SystemStatus {
  integrity: 'ok' | 'corrupt';
  journalMode: string;
  databaseSizeBytes: number;
  backupsSizeBytes: number;
  databasePath: string;
  backupCount: number;
  lastBackup: { name: string; modifiedAt: string } | null;
  lastActivity: string | null;
  payeeCount: number;
  counts: {
    posted: number;
    review: number;
    voided: number;
  };
}

export interface AuditEntry {
  id: number;
  transactionId: number;
  action: 'create' | 'correct' | 'void';
  changedAt: string;
  amountPaise: number;
  note: string | null;
  userId: number | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function formatTime12(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${period}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string } | string;
    } | null;
    const error = payload?.error;
    const message = typeof error === 'string' ? error : error?.message;
    const code = typeof error === 'string' ? 'REQUEST_FAILED' : error?.code;
    throw new ApiError(message ?? `Request failed (${response.status})`, code ?? 'REQUEST_FAILED', response.status);
  }
  return response.json() as Promise<T>;
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function del<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: 'DELETE', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

export function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(paise / 100);
}

export function rupeesToPaise(value: string): number | null {
  const normalized = value.trim().replaceAll(',', '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

export function queryString(
  values: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
