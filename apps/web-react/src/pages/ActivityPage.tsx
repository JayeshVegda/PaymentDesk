import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatInr, formatTime12, LedgerTransaction } from '../api/client';
import { Edit3, Trash2, Inbox, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TransactionDrawer } from '../components/common/TransactionDrawer';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useVoidTransaction } from '../hooks/use-void-transaction';

interface Event {
  id: number;
  action: string;
  changedAt: string;
  source: string;
  transactionId: number;
  amountPaise: number;
  payeeName: string;
}

type ActionFilter = 'all' | 'created' | 'corrected' | 'voided' | 'restored';

const ACTION_ICONS: Record<string, typeof PlusCircle> = {
  created: PlusCircle,
  corrected: Edit3,
  voided: Trash2,
  restored: PlusCircle
};

function dayLabel(isoTimestamp: string): string {
  const day = isoTimestamp.slice(0, 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const yesterdayDate = new Date(`${today}T12:00:00+05:30`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterdayDate);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export default function ActivityPage() {
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Event | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const pageSize = 20;
  const voidTransaction = useVoidTransaction();

  const { data: events = [], refetch } = useQuery<Event[]>({
    queryKey: ['activity-events'],
    queryFn: () => api<Event[]>('/activity?limit=250')
  });

  const filteredEvents = useMemo(
    () => (actionFilter === 'all' ? events : events.filter((event) => event.action === actionFilter)),
    [events, actionFilter]
  );
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleEvents = useMemo(
    () => filteredEvents.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredEvents, safePage]
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const event of visibleEvents) {
      const day = event.changedAt.slice(0, 10);
      const bucket = groups.get(day);
      if (bucket) bucket.push(event);
      else groups.set(day, [event]);
    }
    return [...groups.entries()];
  }, [visibleEvents]);

  const handleEdit = async (transactionId: number) => {
    try {
      const tx = await api<LedgerTransaction>(`/transactions/${transactionId}`);
      setSelectedTx(tx);
    } catch {
      toast.error('Failed to load transaction details');
    }
  };


  return (
    <div className="space-y-4">
      <h1 className="sr-only">Activity</h1>
      {/* Action filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'created', 'corrected', 'voided', 'restored'] as ActionFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setActionFilter(filter);
              setPage(1);
            }}
            aria-pressed={actionFilter === filter}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full border transition-colors cursor-pointer ${
              actionFilter === filter
                ? 'bg-[#E9F1FF] text-[#165DFF] border-[#165DFF]/30'
                : 'bg-white text-[#667085] border-[#DDE3EC] hover:border-[#165DFF] hover:text-[#165DFF]'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="ledger-card bg-white p-0 border border-[#DDE3EC] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-[#DDE3EC]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#667085]">
                    <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-base">No activity logs found</p>
                  </td>
                </tr>
              ) : (
                groupedEvents.map(([day, dayEvents]) => (
                  <React.Fragment key={day}>
                    <tr className="sticky top-0 z-10 bg-[#F6F8FC]">
                      <td colSpan={4} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-[#344054] border-b border-[#DDE3EC]">
                        {dayLabel(dayEvents[0]?.changedAt ?? day)}
                      </td>
                    </tr>
                    {dayEvents.map((event) => {
                      const isVoid = event.action === 'voided';
                      const isRestored = event.action === 'restored';
                      const Icon = ACTION_ICONS[event.action] ?? PlusCircle;
                      return (
                        <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap w-12">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                                isVoid
                                  ? 'bg-rose-50 text-rose-600'
                                  : event.action === 'corrected'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-blue-50 text-blue-600'
                              }`}
                              title={event.action}
                            >
                              <Icon size={15} />
                            </span>
                          </td>
                          <td className="py-3 px-0 font-bold text-slate-800 text-sm whitespace-nowrap">
                            <span className="text-xs font-semibold text-[#667085] mr-2">{formatTime12(event.changedAt.slice(11, 19))}</span>
                            {event.payeeName}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-800 text-sm whitespace-nowrap">
                            {isVoid && <span className="line-through text-rose-500 mr-2">{formatInr(event.amountPaise)}</span>}
                            {!isVoid && formatInr(event.amountPaise)}
                            {isRestored && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-600">restored</span>}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEdit(event.transactionId)}
                                className="p-1 text-slate-500 hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Edit transaction"
                                disabled={isVoid}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmTx(event)}
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Void transaction"
                                disabled={isVoid}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredEvents.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#DDE3EC] bg-[#FAFBFD] px-4 py-3 text-xs text-[#667085]">
            <span>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredEvents.length)} of {filteredEvents.length} changes</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white hover:border-[#165DFF] hover:text-[#165DFF] disabled:opacity-40" aria-label="Previous activity page"><ChevronLeft size={15} /></button>
              <span className="min-w-20 text-center font-semibold text-[#344054]">Page {safePage} of {pageCount}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white hover:border-[#165DFF] hover:text-[#165DFF] disabled:opacity-40" aria-label="Next activity page"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        initialEdit={true}
        onClose={() => {
          setSelectedTx(null);
          refetch();
        }}
      />

      {/* Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmTx}
        title="Void this Transaction?"
        description="Voiding this transaction is permanent. Review details below before continuing."
        type="danger"
        confirmText="Void Transaction"
        previewData={deleteConfirmTx ? {
          'Transaction ID': `#${deleteConfirmTx.transactionId}`,
          'Payee': deleteConfirmTx.payeeName || 'Unknown',
          'Amount': formatInr(deleteConfirmTx.amountPaise || 0),
          'Action Date': deleteConfirmTx.changedAt ? new Date(deleteConfirmTx.changedAt).toLocaleString('en-IN') : 'Unknown'
        } : undefined}
        onConfirm={async () => {
          if (!deleteConfirmTx) return;
          const target = deleteConfirmTx;
          setDeleteConfirmTx(null);
          await voidTransaction({
            id: target.transactionId,
            payeeName: target.payeeName || 'Unknown',
            amountPaise: target.amountPaise || 0,
            reason: 'Voided from Activity Log'
          });
          refetch();
        }}
        onCancel={() => setDeleteConfirmTx(null)}
      />
    </div>
  );
}
