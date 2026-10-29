import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  api,
  patch,
  formatInr,
  formatTime12,
  MasterData,
  LedgerTransaction} from '../api/client';
import { ArrowLeft, Star, Inbox, ChevronLeft, ChevronRight, Edit, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { PayeeAvatar } from '../components/common/PayeeAvatar';
import { StatusPill } from '../components/common/StatusPill';
import { TransactionDrawer } from '../components/common/TransactionDrawer';
import MergePayeeModal from '../components/payees/MergePayeeModal';
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export default function PayeeDetailPage() {
  const { payeeId } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  // Form Edit State
  const [payeeName, setPayeeName] = useState('');
  const [payeeType, setPayeeType] = useState<'person' | 'company'>('person');
  const [aliases, setAliases] = useState('');
  const [notes, setNotes] = useState('');
  const [favourite, setFavourite] = useState(false);
  const [savingPayee, setSavingPayee] = useState(false);

  // Queries
  const { data: master, refetch: refetchMaster } = useQuery<MasterData>({
    queryKey: ['master-data-all'],
    queryFn: () => api<MasterData>('/master-data?includeInactive=true')
  });

  const payee = useMemo(() => {
    return master?.payees.find((p) => p.id.toString() === payeeId);
  }, [master, payeeId]);

  const { data: transactionsData } = useQuery<{ items: LedgerTransaction[] }>({
    queryKey: ['payee-transactions', payeeId],
    queryFn: () => api<{ items: LedgerTransaction[] }>(`/transactions?payeeId=${payeeId}&pageSize=1000`),
    enabled: !!payeeId
  });

  const items = transactionsData?.items || [];
  const activeItems = useMemo(() => items.filter(tx => tx.status !== 'voided'), [items]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = useMemo(() => {
    return items.slice((page - 1) * pageSize, page * pageSize);
  }, [items, page]);

  // KPIs
  const totalPaid = useMemo(() => {
    return activeItems.reduce((sum, item) => sum + item.amountPaise, 0);
  }, [activeItems]);

  const averagePayment = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.round(totalPaid / activeItems.length);
  }, [activeItems, totalPaid]);

  const monthlyOutlay = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const tx of activeItems) {
      const month = tx.transactionDate.slice(0, 7); // YYYY-MM
      groups[month] = (groups[month] || 0) + tx.amountPaise / 100;
    }
    return Object.entries(groups)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeItems]);

  const toggleFavorite = async () => {
    if (!pay) return;
    try {
      await patch(`/payees/${pay.id}`, { favourite: !pay.favourite });
      await refetchMaster();
      toast.success(`${pay.name} ${!pay.favourite ? 'added to' : 'removed from'} favourites`);
    } catch {
      toast.error('Failed to update favourite status');
    }
  };

  const handleEditOpen = () => {
    if (!payee) return;
    setPayeeName(payee.name);
    setPayeeType(payee.type);
    setAliases(payee.aliases?.join(', ') || '');
    setNotes(payee.notes || '');
    setFavourite(payee.favourite);
    setPayeeModalOpen(true);
  };

  const handleSavePayee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName.trim() || savingPayee || !payee) return;
    setSavingPayee(true);
    try {
      const payload = {
        name: payeeName.trim(),
        type: payeeType,
        aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
        notes: notes.trim() || null,
        favourite
      };

      await patch(`/payees/${payee.id}`, payload);
      toast.success(`Updated payee details`);
      await refetchMaster();
      setPayeeModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save payee');
    } finally {
      setSavingPayee(false);
    }
  };

  if (!payee) {
    return (
      <div className="p-12 text-center text-[#667085]">
        <Inbox size={40} className="mx-auto mb-3 opacity-50" />
        <h3 className="text-lg font-bold text-[#111827]">Payee not found</h3>
        <button onClick={() => navigate('/payees')} className="btn btn-secondary mt-3">
          Back to Payees
        </button>
      </div>
    );
  }

  const pay = payee;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between border-b border-[#DDE3EC] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payees')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-[#667085]"
            aria-label="Back to payees"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <PayeeAvatar name={pay.name} size={42} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#111827]">{pay.name}</h1>
                <button onClick={toggleFavorite} className="cursor-pointer">
                  <Star
                    size={20}
                    className={pay.favourite ? 'text-amber-500 fill-amber-500' : 'text-slate-300 hover:text-amber-400'}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {pay.aliases && pay.aliases.length > 0 && (
                  <span className="text-xs text-[#667085]">Aliases: {pay.aliases.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleEditOpen} className="btn btn-secondary h-10 px-4 gap-2 text-slate-700">
            <Edit size={16} />
            <span>Edit Payee</span>
          </button>
          <button
            onClick={() => setMergeModalOpen(true)}
            className="btn btn-secondary h-10 px-4 gap-2 text-slate-700"
            title="Merge this payee into another one and move all payments"
          >
            <GitMerge size={16} />
            <span>Merge</span>
          </button>
        </div>
      </div>

      {/* Payee Info & Notes */}
      {pay.notes && (
        <div className="ledger-card p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Payee Notes</span>
          <p className="text-sm text-amber-900 mt-1 font-medium">{pay.notes}</p>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="ledger-card border-t-2 border-t-[#165DFF] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Total Outgoing</span>
            <div className="mt-1">
              <span className="text-2xl font-black tabular-nums text-[#111827]">{formatInr(totalPaid)}</span>
            </div>
          </div>
          <p className="text-[10px] text-[#667085] mt-2">Sum of all non-voided payments</p>
        </div>

        <div className="ledger-card bg-white p-5 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Payment Count</span>
            <div className="mt-1">
              <span className="text-2xl font-black tabular-nums text-[#111827]">{activeItems.length}</span>
            </div>
          </div>
          <p className="text-[10px] text-[#667085] mt-2">Total successful transactions</p>
        </div>

        <div className="ledger-card bg-white p-5 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Average Payment Size</span>
            <div className="mt-1">
              <span className="text-2xl font-black tabular-nums text-[#111827]">{formatInr(averagePayment)}</span>
            </div>
          </div>
          <p className="text-[10px] text-[#667085] mt-2">Average value per transaction</p>
        </div>
      </div>

      {/* Chart Panel */}
      {monthlyOutlay.length > 0 && (
        <div className="ledger-card bg-white p-5 border border-[#DDE3EC] rounded-2xl shadow-xs">
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] block">Monthly Outlay Trend</span>
            <span className="text-[10px] text-[#667085]">Outflow history grouped by month</span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={monthlyOutlay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#f5f7fa" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#dce3ee' }}
                  tick={{ fontSize: 10, fill: '#66738d' }}
                />
                <YAxis
                  width={72}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#66738d' }}
                  tickFormatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(22,93,255,0.06)' }}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #DDE3EC' }}
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Paid Out']}
                />
                <Bar dataKey="amount" fill="#165DFF" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transaction History Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#667085]">Transaction History</h3>

        <div className="ledger-card bg-white p-0 border border-[#DDE3EC] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F8FC] border-b border-[#DDE3EC] text-xs uppercase font-bold text-[#667085]">
                <tr>
                  <th className="py-3.5 px-5">Date & Time</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">Method</th>
                  <th className="py-3.5 px-5">Note</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#667085]">
                      <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-base">No transaction history</p>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const isDigital = item.paymentMethodCode?.toLowerCase() !== 'cash';
                    const isVoided = item.status === 'voided';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedTx(item)}
                        tabIndex={0}
                        className={`clickable-table-row transition-colors ${isVoided ? 'opacity-50 bg-rose-50/20' : 'hover:bg-[#F6F8FC]'}`}
                      >
                        <td className="py-3.5 px-5 text-xs font-semibold text-[#667085]">
                          <div>{item.transactionDate}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatTime12(item.transactionTime)}</div>
                        </td>

                        <td className="py-3.5 px-5">
                          {item.categoryName ? (
                            <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-md">
                              {item.categoryName}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 rounded-md">
                              Uncategorised
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5">
                          {isDigital ? (
                            <StatusPill variant="blue" label={item.paymentMethodName || 'Digital/Bank'} />
                          ) : (
                            <StatusPill variant="gray" label="Cash" />
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-xs text-slate-600 truncate max-w-xs">
                          {item.note || '—'}
                        </td>

                        <td className="py-3.5 px-5 text-right font-black tabular-nums text-[#111827] text-base">
                          {isVoided && <span className="line-through text-rose-500 mr-2">{formatInr(item.amountPaise)}</span>}
                          {!isVoided && formatInr(item.amountPaise)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#DDE3EC] bg-[#F6F8FC] flex items-center justify-between text-xs text-[#667085]">
              <span>
                Page <strong className="text-[#111827]">{page}</strong> of <strong className="text-[#111827]">{totalPages}</strong> ({items.length} items)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-secondary h-8 px-3 text-xs cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-secondary h-8 px-3 text-xs cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      {/* Payee Merge Modal */}
      {mergeModalOpen && pay && master && (
        <MergePayeeModal
          source={pay}
          payees={master.payees}
          onClose={() => setMergeModalOpen(false)}
          onMerged={(targetId) => {
            setMergeModalOpen(false);
            navigate(`/payees/${targetId}`);
          }}
        />
      )}

      {/* Payee Edit Modal */}
      {payeeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#111827]">Edit Payee Details</h2>

            <form onSubmit={handleSavePayee} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Payee Name *
                </label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="form-input"
                />
              </div>



              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Aliases (comma separated)
                </label>
                <input
                  type="text"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-input h-auto py-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="favCheck"
                  checked={favourite}
                  onChange={(e) => setFavourite(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DDE3EC] text-[#165DFF]"
                />
                <label htmlFor="favCheck" className="text-sm font-medium text-[#111827]">
                  Mark as Favourite Payee
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DDE3EC]">
                <button
                  type="button"
                  onClick={() => setPayeeModalOpen(false)}
                  className="btn btn-secondary h-10 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayee}
                  className="btn btn-primary h-10 px-5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
