import React, { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  LedgerTransaction,
  formatInr,
  formatTime12,
  patch,
  rupeesToPaise,
  MasterData,
  api
} from '../../api/client';
import { PayeeAvatar } from './PayeeAvatar';
import { StatusPill } from './StatusPill';
import { X, Calendar, Clock, CreditCard, Folder, CheckCircle, AlertTriangle, Trash2, Edit3, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';
import { useVoidTransaction } from '../../hooks/use-void-transaction';

interface TransactionDrawerProps {
  transaction: LedgerTransaction | null;
  onClose: () => void;
  initialEdit?: boolean;
}

export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({ transaction, onClose, initialEdit }) => {
  const queryClient = useQueryClient();
  const voidTransaction = useVoidTransaction();
  const [isVoiding, setIsVoiding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [amountRupees, setAmountRupees] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const [savePayload, setSavePayload] = useState<{
    transactionDate: string;
    transactionTime: string;
    amountPaise: number;
    categoryId: number | null;
    paymentMethodId: number | null;
    note: string | null;
    expectedUpdatedAt: string;
  } | null>(null);

  // Fetch master data for select dropdowns
  const { data: master } = useQuery<MasterData>({
    queryKey: ['master-data-all'],
    queryFn: () => api<MasterData>('/master-data?includeInactive=true')
  });

  // Sync state when transaction changes or editing starts
  useEffect(() => {
    if (transaction) {
      setAmountRupees((transaction.amountPaise / 100).toString());
      setCategoryId(transaction.categoryId?.toString() || '');
      setMethodId(transaction.paymentMethodId?.toString() || '');
      setDate(transaction.transactionDate);
      setTime(transaction.transactionTime);
      setNote(transaction.note || '');
      setIsEditing(!!initialEdit);
      setErrorMsg(null);
    }
  }, [transaction, initialEdit]);

  if (!transaction) return null;

  const isVoided = transaction.status === 'voided';
  const isDigital = transaction.paymentMethodCode?.toLowerCase() !== 'cash';

  const handleVoidTrigger = () => {
    setConfirmVoidOpen(true);
  };

  const executeVoid = async () => {
    setConfirmVoidOpen(false);
    setIsVoiding(true);
    setErrorMsg(null);
    const success = await voidTransaction({
      id: transaction.id,
      payeeName: transaction.payeeName,
      amountPaise: transaction.amountPaise,
      reason: 'Voided after user review'
    });
    setIsVoiding(false);
    if (success) onClose();
  };

  const handleSaveTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const paise = rupeesToPaise(amountRupees);
      if (paise === null || paise <= 0) throw new Error('Enter a valid payment amount');

      const payload = {
        transactionDate: date,
        transactionTime: time,
        amountPaise: paise,
        categoryId: categoryId ? Number(categoryId) : null,
        paymentMethodId: methodId ? Number(methodId) : null,
        note: note.trim() || null,
        expectedUpdatedAt: transaction.updatedAt
      };

      setSavePayload(payload);
      setConfirmSaveOpen(true);
    } catch (error) {
      setErrorMsg(((error instanceof Error ? error.message : null) ?? 'Validation failed'));
    }
  };

  const executeSave = async () => {
    setConfirmSaveOpen(false);
    setSaving(true);
    setErrorMsg(null);
    try {
      await patch(`/transactions/${transaction.id}`, savePayload);
      for (const key of ['ledger-transactions', 'transactions', 'master-data', 'dashboard', 'activity-events', 'payee-transactions']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success('Transaction details updated');
      setIsEditing(false);
      onClose();
    } catch (error) {
      setErrorMsg(((error instanceof Error ? error.message : null) ?? 'Failed to update transaction'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-200"
        style={{ boxShadow: 'var(--shadow-drawer)' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#DDE3EC] flex items-center justify-between bg-[#F6F8FC]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">
              Transaction Details #{transaction.id}
            </span>
            <h2 className="text-xl font-bold text-[#111827] mt-0.5">
              {transaction.payeeName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isVoided && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-500 hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer"
                title="Edit entry"
              >
                <Edit3 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#667085] hover:text-[#111827] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveTrigger} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Amount (INR) *
                </label>
                <input
                  type="text"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="form-input text-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                    Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="form-input"
                >
                  <option value="">Uncategorised</option>
                  {master?.categories.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Payment Method
                </label>
                <select
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className="form-input"
                >
                  {master?.paymentMethods.map((m) => (
                    <option key={m.id} value={m.id.toString()}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Note
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="form-input h-auto py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DDE3EC]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary h-10 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary h-10 px-5 gap-1.5 cursor-pointer text-white"
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Amount Display */}
              <div className="p-6 rounded-xl bg-[#F6F8FC] border border-[#DDE3EC] text-center">
                <span className="text-xs font-semibold text-[#667085] block">AMOUNT PAID</span>
                <span className="text-4xl font-extrabold tabular-nums text-[#111827] block mt-1">
                  {formatInr(transaction.amountPaise)}
                </span>
                <div className="mt-3 flex justify-center gap-2">
                  {isVoided ? (
                    <StatusPill variant="amber" label="VOIDED" />
                  ) : transaction.needsReview ? (
                    <StatusPill variant="amber" label="Needs Review" icon={<AlertTriangle size={12} />} />
                  ) : (
                    <StatusPill variant="green" label="Posted" icon={<CheckCircle size={12} />} />
                  )}

                  {isDigital ? (
                    <StatusPill variant="blue" label={transaction.paymentMethodName || 'Digital/Bank'} />
                  ) : (
                    <StatusPill variant="gray" label="Cash" />
                  )}
                </div>
              </div>

              {/* Detailed Info Grid */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-[#DDE3EC]">
                  <PayeeAvatar name={transaction.payeeName} size={36} />
                  <div>
                    <span className="text-xs font-medium text-[#667085]">Payee</span>
                    <p className="text-sm font-semibold text-[#111827]">{transaction.payeeName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                    <Calendar size={18} className="text-[#165DFF]" />
                    <div>
                      <span className="text-xs font-medium text-[#667085]">Date</span>
                      <p className="text-sm font-semibold text-[#111827]">{transaction.transactionDate}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                    <Clock size={18} className="text-[#165DFF]" />
                    <div>
                      <span className="text-xs font-medium text-[#667085]">Time</span>
                      <p className="text-sm font-semibold text-[#111827]">{formatTime12(transaction.transactionTime)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                  <Folder size={18} className="text-[#165DFF]" />
                  <div>
                    <span className="text-xs font-medium text-[#667085]">Category</span>
                    <p className="text-sm font-semibold text-[#111827]">
                      {transaction.categoryName || 'Uncategorised'}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                  <CreditCard size={18} className="text-[#165DFF]" />
                  <div>
                    <span className="text-xs font-medium text-[#667085]">Payment Method</span>
                    <p className="text-sm font-semibold text-[#111827]">
                      {transaction.paymentMethodName || 'Cash'}
                    </p>
                  </div>
                </div>

                {transaction.note && (
                  <div className="p-4 rounded-lg bg-amber-50/40 border border-amber-100">
                    <span className="text-xs font-semibold text-amber-800">Note / Details</span>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{transaction.note}</p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-[#667085]">
                  <span>Source: <strong className="font-mono text-slate-700">{transaction.source.toUpperCase()}</strong></span>
                  <span>Version: {transaction.version}</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-[#DDE3EC] bg-white flex items-center justify-between gap-3">
                {!isVoided ? (
                  <button
                    onClick={handleVoidTrigger}
                    disabled={isVoiding}
                    className="btn btn-secondary w-full text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                  >
                    <Trash2 size={16} />
                    <span>{isVoiding ? 'Voiding...' : 'Void Transaction'}</span>
                  </button>
                ) : (
                  <div className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-lg w-full text-center">
                    Transaction Voided
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={confirmSaveOpen}
        title="Save Transaction Changes?"
        description="Are you sure you want to update this transaction's details? Review the updated preview details below."
        type="info"
        confirmText="Save Changes"
        previewData={savePayload ? {
          'Payee': transaction.payeeName,
          'Amount': formatInr(savePayload.amountPaise),
          'Category': master?.categories.find(c => c.id === savePayload.categoryId)?.name || 'Uncategorised',
          'Payment Method': master?.paymentMethods.find(m => m.id === savePayload.paymentMethodId)?.displayName || 'Cash',
          'Date': savePayload.transactionDate,
          'Time': formatTime12(savePayload.transactionTime),
          'Note': savePayload.note || 'None'
        } : undefined}
        onConfirm={executeSave}
        onCancel={() => setConfirmSaveOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmVoidOpen}
        title="Void this Transaction?"
        description="Voiding this transaction is permanent and cannot be undone. Please review the details below before confirming."
        type="danger"
        confirmText="Void Transaction"
        previewData={{
          'Payee': transaction.payeeName,
          'Amount': formatInr(transaction.amountPaise),
          'Category': transaction.categoryName || 'Uncategorised',
          'Payment Method': transaction.paymentMethodName || 'Cash',
          'Date': transaction.transactionDate,
          'Note': transaction.note || 'None'
        }}
        onConfirm={executeVoid}
        onCancel={() => setConfirmVoidOpen(false)}
      />
    </div>
  );
};
