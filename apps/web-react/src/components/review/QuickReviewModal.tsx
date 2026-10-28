import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MasterData, formatInr, patch } from '../../api/client';
import { X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QuickReviewModalProps {
  open: boolean;
  onClose: () => void;
  master: MasterData;
  transaction: {
    id: number;
    updatedAt: string;
    payeeId?: number;
    amountPaise?: number;
    payeeName?: string;
    categoryId?: number | null;
    paymentMethodId?: number | null;
  } | null;
  onSaved: () => void;
}

export default function QuickReviewModal({
  open,
  onClose,
  master,
  transaction,
  onSaved
}: QuickReviewModalProps) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [remember, setRemember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCategoryId(transaction?.categoryId?.toString() || '');
      setMethodId(
        transaction?.paymentMethodId?.toString() ||
        master.paymentMethods.find((method) => method.code === 'cash')?.id.toString() ||
        ''
      );
      setRemember(Boolean(transaction?.payeeId));
      setError('');
    }
  }, [open, transaction]);

  if (!open || !transaction) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !methodId) {
      setError('Choose both a category and payment method to complete the review.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await patch(`/transactions/${transaction.id}`, {
        categoryId: Number(categoryId),
        paymentMethodId: Number(methodId),
        needsReview: false,
        expectedUpdatedAt: transaction.updatedAt,
        source: 'web'
      });
      if (remember && transaction.payeeId) {
        await patch(`/payees/${transaction.payeeId}`, {
          defaultCategoryId: Number(categoryId),
          defaultPaymentMethodId: Number(methodId)
        });
      }
      toast.success('Payment review completed');
      await queryClient.invalidateQueries();
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Review could not be completed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/45" onClick={onClose} />

      {/* Dialog content */}
      <div className="relative w-full max-w-[420px] bg-white rounded-xl shadow-2xl z-10 border border-ledger-border animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-ledger-border">
          <div>
            <span className="text-[10px] uppercase font-bold text-ledger-review tracking-wider">
              Verification required
            </span>
            <h2 className="text-lg font-bold text-ledger-ink leading-tight">
              Review saved payment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-ledger-selection text-ledger-muted hover:text-ledger-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-ledger-review/10 border border-ledger-review/20 text-ledger-review rounded-md">
              {error}
            </div>
          )}

          <div className="text-center py-2 bg-ledger-workspace/30 border border-ledger-border rounded-lg">
            <strong className="block text-2xl font-mono text-ledger-ink tracking-tight tabular-nums">
              {transaction.amountPaise !== undefined ? formatInr(transaction.amountPaise) : '—'}
            </strong>
            <p className="text-xs text-ledger-muted mt-1">
              Paid to <span className="font-semibold text-ledger-ink">{transaction.payeeName ?? 'Unknown'}</span>
            </p>
          </div>

          <div className="p-3 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            <strong>Reason:</strong>{' '}
            {!transaction.categoryId && !transaction.paymentMethodId
              ? 'Category and payment method are missing.'
              : !transaction.categoryId
                ? 'Category is missing.'
                : !transaction.paymentMethodId
                  ? 'Payment method is missing.'
                  : 'This payment was marked for manual verification.'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Payment method</label>
            <select
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              className="form-input"
              required
            >
              {master.paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.displayName}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-ledger-border p-3 text-xs text-ledger-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <strong className="block text-ledger-ink">Remember for this payee</strong>
              Suggest this category next time. Cash still remains the desk-wide payment default.
            </span>
          </label>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ledger-muted">Select Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="form-input"
              required
              autoFocus
            >
              <option value="">Choose category...</option>
              {master.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              type="button"
              className="btn btn-secondary text-xs flex-1 py-2"
            >
              Postpone
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs flex-1 py-2 gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Completing...' : 'Verify payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
