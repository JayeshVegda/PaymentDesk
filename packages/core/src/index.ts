import {
  correctTransactionSchema,
  createTransactionSchema,
  type ChangeSource,
  type CorrectTransactionInput,
  type CreateTransactionInput
} from '@payment-ledger/shared';

export interface TransactionRecord {
  id: number;
  transactionDate: string;
  transactionTime: string;
  payeeId: number;
  amountPaise: number;
  categoryId: number | null;
  paymentMethodId: number | null;
  note: string | null;
  source: ChangeSource;
  status: 'posted' | 'voided';
  needsReview: boolean;
  silent: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface TransactionRepository {
  create(input: CreateTransactionInput): Promise<TransactionRecord>;
  correct(id: number, input: CorrectTransactionInput): Promise<TransactionRecord>;
  void(id: number, reason: string, source: ChangeSource): Promise<TransactionRecord>;
  unvoid(id: number, source: ChangeSource): Promise<TransactionRecord>;
  findById(id: number): Promise<TransactionRecord | null>;
}

export class TransactionNotFoundError extends Error {
  override name = 'TransactionNotFoundError';
}

export class TransactionConflictError extends Error {
  override name = 'TransactionConflictError';
}

export class DuplicateTransactionError extends Error {
  override name = 'DuplicateTransactionError';
}

export class NewPayeeRequiresConfirmationError extends Error {
  override name = 'NewPayeeRequiresConfirmationError';
}

export class TransactionService {
  constructor(private readonly transactions: TransactionRepository) {}

  async create(input: CreateTransactionInput): Promise<TransactionRecord> {
    const validated = createTransactionSchema.parse(input);
    return this.transactions.create(validated);
  }

  async correct(id: number, input: CorrectTransactionInput): Promise<TransactionRecord> {
    await this.requireTransaction(id);
    return this.transactions.correct(id, correctTransactionSchema.parse(input));
  }

  async void(id: number, reason: string, source: ChangeSource): Promise<TransactionRecord> {
    await this.requireTransaction(id);
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new TypeError('A reason is required to void a transaction');
    return this.transactions.void(id, trimmedReason, source);
  }

  async unvoid(id: number, source: ChangeSource): Promise<TransactionRecord> {
    await this.requireTransaction(id);
    return this.transactions.unvoid(id, source);
  }

  private async requireTransaction(id: number): Promise<TransactionRecord> {
    const transaction = await this.transactions.findById(id);
    if (!transaction) throw new TransactionNotFoundError(`Transaction ${id} was not found`);
    return transaction;
  }
}
