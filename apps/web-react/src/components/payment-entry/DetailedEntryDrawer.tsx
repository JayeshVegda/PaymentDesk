import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MasterData, rupeesToPaise, formatInr, post } from '../../api/client';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface DetailedEntryDrawerProps {
  open: boolean;
  onClose: () => void;
  master: MasterData;
  onSaved: () => void;
}

const formSchema = z.object({
  payeeId: z.string().min(1, 'Please select a payee.'),
  amount: z.string()
    .min(1, 'Please enter an amount.')
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, 'Amount must be a positive number.')
    .refine((val) => {
      return /^\d+(\.\d{1,2})?$/.test(val);
    }, 'Amount must have at most 2 decimal places.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  methodId: z.string().min(1, 'Please select a payment method.'),
  date: z.string().min(1, 'Please select a transaction date.'),
  time: z.string().min(1, 'Please select a transaction time.'),
  note: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function DetailedEntryDrawer({
  open,
  onClose,
  master,
  onSaved
}: DetailedEntryDrawerProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payeeId: '',
      amount: '',
      categoryId: '',
      methodId: '',
      date: '',
      time: '',
      note: ''
    }
  });

  const watchedPayeeId = watch('payeeId');

  // Trigger reset defaults on open
  useEffect(() => {
    if (open) {
      const cashMethod = master.paymentMethods.find((m) => m.code === 'cash');
      const now = new Date();
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      const localTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(now);

      reset({
        payeeId: '',
        amount: '',
        categoryId: '',
        methodId: cashMethod ? cashMethod.id.toString() : '',
        date: localDate,
        time: localTime,
        note: ''
      });
    }
  }, [open, master, reset]);

  // Handle defaults trigger on payee change
  useEffect(() => {
    if (watchedPayeeId) {
      const payee = master.payees.find((p) => p.id === Number(watchedPayeeId));
      if (payee) {
        if (payee.defaultCategoryId) {
          setValue('categoryId', payee.defaultCategoryId.toString(), { shouldValidate: true });
        }
        if (payee.defaultPaymentMethodId) {
          setValue('methodId', payee.defaultPaymentMethodId.toString(), { shouldValidate: true });
        }
      }
    }
  }, [watchedPayeeId, master.payees, setValue]);

  if (!open) return null;

  const onSubmit = async (values: FormValues) => {
    const amountPaise = rupeesToPaise(values.amount);
    if (amountPaise === null) {
      toast.error('Invalid amount format.');
      return;
    }
    try {
      await post('/transactions', {
        payeeId: Number(values.payeeId),
        amountPaise,
        categoryId: Number(values.categoryId),
        paymentMethodId: Number(values.methodId),
        note: values.note?.trim() || null,
        needsReview: false,
        transactionDate: values.date,
        transactionTime: `${values.time}:00`
      });
      toast.success('Detailed payment saved', {
        description: `${formatInr(amountPaise)} recorded.`
      });
      onSaved();
      onClose();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Payment could not be saved');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-[420px] h-full bg-white shadow-2xl flex flex-col z-10 border-l border-ledger-border animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between px-6 py-4 border-b border-ledger-border">
          <div>
            <h2 className="text-lg font-bold text-ledger-ink">Detailed Entry</h2>
            <p className="text-xs text-ledger-muted">Record custom or backdated transaction</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-ledger-selection text-ledger-muted hover:text-ledger-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form id="detailed-entry-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Payee</label>
            <select
              {...register('payeeId')}
              className={`form-input ${errors.payeeId ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
            >
              <option value="">Select payee...</option>
              {master.payees.map((payee) => (
                <option key={payee.id} value={payee.id}>
                  {payee.name} {payee.active === false ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
            {errors.payeeId && (
              <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.payeeId.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Amount (₹)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1500.50"
              {...register('amount')}
              className={`form-input ${errors.amount ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
            />
            {errors.amount && (
              <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.amount.message}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ledger-muted">Date</label>
              <input
                type="date"
                {...register('date')}
                className={`form-input ${errors.date ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
              />
              {errors.date && (
                <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.date.message}</span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ledger-muted">Time</label>
              <input
                type="time"
                {...register('time')}
                className={`form-input ${errors.time ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
              />
              {errors.time && (
                <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.time.message}</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Category</label>
            <select
              {...register('categoryId')}
              className={`form-input ${errors.categoryId ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
            >
              <option value="">Select category...</option>
              {master.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.categoryId.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Payment Method</label>
            <select
              {...register('methodId')}
              className={`form-input ${errors.methodId ? 'border-ledger-review focus:ring-ledger-review focus:border-ledger-review' : ''}`}
            >
              <option value="">Select method...</option>
              {master.paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.displayName}
                </option>
              ))}
            </select>
            {errors.methodId && (
              <span className="text-[10px] text-ledger-review mt-1 block font-semibold">{errors.methodId.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Purpose / Note</label>
            <textarea
              rows={3}
              placeholder="Explain transaction details..."
              {...register('note')}
              className="form-input resize-none"
            />
          </div>
        </form>

        <footer className="p-6 border-t border-ledger-border bg-ledger-workspace/50 flex gap-3">
          <button onClick={onClose} type="button" className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            form="detailed-entry-form"
            disabled={isSubmitting}
            className="btn btn-primary flex-1 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Payment'}
          </button>
        </footer>
      </div>
    </div>
  );
}
