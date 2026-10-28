import { z } from 'zod';

export const BUSINESS_TIME_ZONE = 'Asia/Kolkata' as const;

export const sourceSchema = z.enum(['web', 'telegram', 'import', 'job', 'system']);
export type ChangeSource = z.infer<typeof sourceSchema>;

export const transactionStatusSchema = z.enum(['posted', 'voided']);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const payeeTypeSchema = z.enum(['person', 'company']);
export type PayeeType = z.infer<typeof payeeTypeSchema>;

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, 'Expected HH:mm:ss');

export const paiseSchema = z.number().int().safe().positive();
export type Paise = z.infer<typeof paiseSchema>;

export const createTransactionSchema = z
  .object({
    transactionDate: dateSchema,
    transactionTime: timeSchema,
    payeeId: z.number().int().positive(),
    amountPaise: paiseSchema,
    categoryId: z.number().int().positive().nullable(),
    paymentMethodId: z.number().int().positive().nullable(),
    note: z.string().trim().max(2000).nullable(),
    source: sourceSchema,
    needsReview: z.boolean(),
    silent: z.boolean().optional().default(false)
  })
  .superRefine((value, context) => {
    if (!value.needsReview && (value.categoryId === null || value.paymentMethodId === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Missing category or payment method requires review',
        path: ['needsReview']
      });
    }
  });

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

export const correctTransactionSchema = z.object({
  transactionDate: dateSchema.optional(),
  transactionTime: timeSchema.optional(),
  amountPaise: paiseSchema.optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  paymentMethodId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  needsReview: z.boolean().optional(),
  expectedUpdatedAt: z.string().min(1),
  source: sourceSchema
});

export type CorrectTransactionInput = z.infer<typeof correctTransactionSchema>;
