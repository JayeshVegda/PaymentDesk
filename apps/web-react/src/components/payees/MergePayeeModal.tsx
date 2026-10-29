import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GitMerge, Search } from 'lucide-react';
import { toast } from 'sonner';
import { post, formatInr, MergePayeesResult, Payee } from '../../api/client';
import { PayeeAvatar } from '../common/PayeeAvatar';

interface MergePayeeModalProps {
  source: Payee;
  payees: Payee[];
  onClose: () => void;
  onMerged: (targetId: number) => void;
}

export default function MergePayeeModal({ source, payees, onClose, onMerged }: MergePayeeModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payees.filter(
      (payee) =>
        payee.id !== source.id &&
        payee.active &&
        (!query || payee.name.toLowerCase().includes(query))
    );
  }, [payees, source.id, search]);

  const target = useMemo(() => payees.find((payee) => payee.id === targetId) ?? null, [payees, targetId]);

  const handleMerge = async () => {
    if (!target) return;
    setMerging(true);
    try {
      const result = await post<MergePayeesResult>('/payees/merge', {
        sourceId: source.id,
        targetId: target.id
      });
      for (const key of [
        'ledger-transactions',
        'transactions',
        'master-data',
        'master-data-all',
        'dashboard',
        'activity-events',
        'payee-transactions'
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(`Merged ${result.source.name} into ${result.target.name}`, {
        description: `${result.movedTransactions} payment record${result.movedTransactions === 1 ? '' : 's'} moved · "${result.source.name}" kept as an alias`
      });
      onMerged(result.target.id);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-2xl z-10 border border-[#DDE3EC] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-[#DDE3EC]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F0F4FF]">
            <GitMerge size={17} className="text-[#165DFF]" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111827]">Merge duplicate payees</h2>
            <p className="text-xs text-[#667085]">All payments move to the payee you pick below.</p>
          </div>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#DDE3EC] bg-[#F6F8FC] p-3">
            <PayeeAvatar name={source.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#111827]">{source.name}</p>
              <p className="text-[11px] text-[#667085]">
                {source.paymentCount} payment{source.paymentCount === 1 ? '' : 's'} · {formatInr(source.totalPaidPaise)} total
              </p>
            </div>
            <ArrowRight size={16} className="text-[#667085]" />
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the payee to keep…"
              aria-label="Search the payee to keep"
              className="form-input form-input-with-icon h-10 text-sm"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#DDE3EC] divide-y divide-[#DDE3EC]">
            {candidates.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#667085]">No active payees match.</p>
            ) : (
              candidates.map((payee) => (
                <button
                  key={payee.id}
                  type="button"
                  onClick={() => setTargetId(payee.id)}
                  className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${
                    targetId === payee.id ? 'bg-[#E9F1FF]' : 'hover:bg-[#F6F8FC]'
                  }`}
                >
                  <PayeeAvatar name={payee.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{payee.name}</p>
                    <p className="text-[11px] text-[#667085]">
                      {payee.paymentCount} payment{payee.paymentCount === 1 ? '' : 's'} · {formatInr(payee.totalPaidPaise)}
                    </p>
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      targetId === payee.id ? 'border-[#165DFF] bg-[#165DFF]' : 'border-[#DDE3EC]'
                    }`}
                  />
                </button>
              ))
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[#667085]">
            "{source.name}" is kept as an alias of the payee you keep, so quick-entry still recognises it.
            Every payment, including voided ones, is moved and recorded in the audit trail. This cannot be
            undone automatically — correct individual payments afterwards if needed.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#DDE3EC] px-5 py-3.5 bg-[#F6F8FC]">
          <button onClick={onClose} className="btn btn-secondary h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!target || merging}
            className="btn btn-primary h-10 px-4 text-sm gap-2 bg-[#165DFF] hover:bg-[#0E4FD8] border-none text-white"
          >
            <GitMerge size={15} />
            <span>{merging ? 'Merging…' : target ? `Merge into ${target.name}` : 'Pick a payee to keep'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
