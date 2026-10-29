import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  formatInr,
  formatTime12,
  queryString,
  ApiError,
  LedgerTransaction,
  MasterData,
  TransactionPage,
  patch,
  Category,
  PaymentMethod
} from '../api/client';
import { Search, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { PayeeAvatar } from '../components/common/PayeeAvatar';
import { StatusPill } from '../components/common/StatusPill';
import { TransactionDrawer } from '../components/common/TransactionDrawer';
import { useToday } from '../hooks/use-today';

type Draft = {
  categoryId: string;
  methodId: string;
  remember: boolean;
};

const EMPTY_DRAFT: Draft = { categoryId: '', methodId: '', remember: false };

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const isConflictError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'TRANSACTION_CONFLICT';

function Pager({
  page,
  totalPages,
  total,
  onPage
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (next: number) => void;
}) {
  return (
    <div className="p-4 border-t border-[#DDE3EC] bg-[#F6F8FC] flex items-center justify-between text-xs text-[#667085]">
      <span>
        Page <strong className="text-[#111827]">{page}</strong> of{' '}
        <strong className="text-[#111827]">{totalPages}</strong> ({total} items)
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="btn btn-secondary h-8 px-3 text-xs"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="btn btn-secondary h-8 px-3 text-xs"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

interface ReviewRowProps {
  item: LedgerTransaction;
  draft: Draft;
  resolving: boolean;
  disabled: boolean;
  categories: Category[];
  methods: PaymentMethod[];
  onDraftChange: (txId: number, field: keyof Draft, value: string | boolean) => void;
  onResolve: (item: LedgerTransaction) => void;
}

const ReviewRow = React.memo(function ReviewRow({
  item,
  draft,
  resolving,
  disabled,
  categories,
  methods,
  onDraftChange,
  onResolve
}: ReviewRowProps) {
  const isAged = useMemo(() => {
    const txTime = new Date(`${item.transactionDate}T00:00:00`).getTime();
    return (Date.now() - txTime) / (1000 * 3600 * 24) > 7;
  }, [item.transactionDate]);
  const isValid = Boolean(draft.categoryId && draft.methodId);

  return (
    <div
      className={`bg-white px-4 py-3 transition-colors hover:bg-slate-50 ${isAged ? 'border-l-2 border-l-[#F79009]' : ''}`}
    >
      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(240px,1fr)_130px_minmax(390px,auto)]">
        {/* Left: Transaction Info */}
        <div className="flex min-w-0 items-center gap-3">
          <PayeeAvatar name={item.payeeName} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-[#111827]">{item.payeeName}</span>
              {isAged && <span className="text-[11px] font-medium text-amber-700">· over 7 days</span>}
            </div>

            <div className="mt-0.5 text-xs text-[#667085]">
              {item.transactionDate} · {formatTime12(item.transactionTime)} ·{' '}
              {item.source.charAt(0).toUpperCase() + item.source.slice(1)}
            </div>

            <div className="mt-1 text-[11px] font-semibold text-amber-700">
              {!item.categoryId && !item.paymentMethodId
                ? 'Missing category and payment method'
                : !item.categoryId
                  ? 'Missing category'
                  : !item.paymentMethodId
                    ? 'Missing payment method'
                    : 'Manual verification requested'}
            </div>

            {item.note && <p className="mt-0.5 truncate text-xs text-slate-600">{item.note}</p>}
          </div>
        </div>

        {/* Middle: Right-Aligned Amount */}
        <div className="text-left lg:text-right col-span-1">
          <span className="text-base font-bold tabular-nums text-[#111827]">{formatInr(item.amountPaise)}</span>
        </div>

        {/* Right: Selectors & Resolve Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="w-full sm:w-40">
            <select
              value={draft.categoryId}
              onChange={(e) => onDraftChange(item.id, 'categoryId', e.target.value)}
              aria-label={`Category for ${item.payeeName}`}
              className={`form-input text-xs font-medium h-9 ${!draft.categoryId ? 'border-amber-400 bg-amber-50/50' : ''}`}
            >
              <option value="">Category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id.toString()}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-32">
            <select
              value={draft.methodId}
              onChange={(e) => onDraftChange(item.id, 'methodId', e.target.value)}
              aria-label={`Payment method for ${item.payeeName}`}
              className="form-input text-xs font-medium h-9"
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id.toString()}>
                  {method.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-center">
            <input
              type="checkbox"
              id={`remember-${item.id}`}
              checked={draft.remember}
              onChange={(e) => onDraftChange(item.id, 'remember', e.target.checked)}
              className="w-4 h-4 rounded border-[#DDE3EC] text-[#165DFF]"
            />
            <label
              htmlFor={`remember-${item.id}`}
              className="text-xs font-semibold text-[#667085] whitespace-nowrap cursor-pointer"
            >
              Remember rule
            </label>
          </div>

          <button
            onClick={() => onResolve(item)}
            disabled={!isValid || resolving || disabled}
            className="btn btn-primary h-9 px-4 text-xs shrink-0 cursor-pointer self-center"
          >
            {resolving ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default function LedgerPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const today = useToday();

  // Filter States
  const [savedView, setSavedView] = useState<string>('today');
  const [date, setDate] = useState(today);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 250);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [page, setPage] = useState(1);

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    api<LedgerTransaction>(`/transactions/${transactionId}`)
      .then((transaction) => {
        if (!cancelled) setSelectedTx(transaction);
      })
      .catch(() => {
        toast.error('Transaction could not be opened');
        navigate('/ledger', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId, navigate]);

  // Review specific states
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [resolvingIds, setResolvingIds] = useState<Record<number, boolean>>({});
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const dirtyIds = useRef<Set<number>>(new Set());

  // Sync savedView with location path (support G R / G E chords and nav clicks)
  useEffect(() => {
    if (location.pathname === '/review') {
      setSavedView('review');
      setReviewOnly(true);
      setIncludeVoided(false);
      setPage(1);
    } else if (location.pathname === '/ledger') {
      setSavedView('today');
      setReviewOnly(false);
      setIncludeVoided(false);
      setPage(1);
    }
  }, [location.pathname]);

  // Queries
  const { data: master, isError: masterError } = useQuery<MasterData>({
    queryKey: ['master-data'],
    queryFn: () => api<MasterData>('/master-data')
  });

  const monthStart = `${today.slice(0, 8)}01`;
  const dateApplies = savedView !== 'month' && savedView !== 'all';
  const from = savedView === 'month' ? monthStart : undefined;

  const { data: result, isError: transactionsError, refetch: refetchTransactions } = useQuery<TransactionPage>({
    queryKey: [
      'ledger-transactions',
      savedView,
      dateApplies ? date : null,
      from ?? null,
      search,
      reviewOnly,
      includeVoided,
      page
    ],
    queryFn: () =>
      api<TransactionPage>(
        `/transactions${queryString({
          date: dateApplies ? date : undefined,
          from,
          search: search || undefined,
          reviewOnly,
          includeVoided,
          page,
          pageSize: 50
        })}`
      ),
    placeholderData: (previous) => previous,
    // Poll every 30s while the tab is visible; paused in background tabs
    refetchInterval: 30000,
    refetchIntervalInBackground: false
  });

  const items = useMemo(() => result?.items || [], [result]);
  const total = result?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / (result?.pageSize || 50)));
  const hasError = masterError || transactionsError;

  // Keep the drawer's transaction fresh when the list refetches
  useEffect(() => {
    if (!selectedTx) return;
    const fresh = items.find((item) => item.id === selectedTx.id);
    if (fresh && fresh.updatedAt !== selectedTx.updatedAt) setSelectedTx(fresh);
  }, [items, selectedTx]);

  // Self-correct out-of-range pages after items shrink (bulk resolve, deletes)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Seed drafts with fresh server values; keep only fields the user touched.
  // Also prunes drafts of items that left the queue.
  useEffect(() => {
    if (savedView !== 'review' || !master) return;
    const defaultCashId = master.paymentMethods.find((m) => m.code === 'cash')?.id.toString() || '';
    setDrafts((prev) => {
      const next: Record<number, Draft> = {};
      for (const item of items) {
        const kept = dirtyIds.current.has(item.id) ? prev[item.id] : undefined;
        next[item.id] = kept ?? {
          categoryId: item.categoryId?.toString() || '',
          methodId: item.paymentMethodId?.toString() || defaultCashId,
          remember: false
        };
      }
      return next;
    });
  }, [items, master, savedView]);

  const handleDraftChange = useCallback(
    (txId: number, field: keyof Draft, value: string | boolean) => {
      dirtyIds.current.add(txId);
      setDrafts((prev) => ({
        ...prev,
        [txId]: {
          ...(prev[txId] ?? EMPTY_DRAFT),
          [field]: value
        }
      }));
    },
    []
  );

  const invalidateLedgerData = useCallback(() => {
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
  }, [queryClient]);

  const resolveOne = useCallback(async (item: LedgerTransaction, draft: Draft): Promise<void> => {
    await patch(`/transactions/${item.id}`, {
      categoryId: Number(draft.categoryId),
      paymentMethodId: Number(draft.methodId),
      needsReview: false,
      expectedUpdatedAt: item.updatedAt,
      source: 'web'
    });
    if (draft.remember) {
      try {
        await patch(`/payees/${item.payeeId}`, {
          defaultCategoryId: Number(draft.categoryId),
          defaultPaymentMethodId: Number(draft.methodId)
        });
      } catch {
        toast.warning(`Resolved ${item.payeeName}, but the payee rule was not saved`);
      }
    }
  }, []);

  const handleResolve = useCallback(
    async (item: LedgerTransaction) => {
      const draft = drafts[item.id];
      if (!draft || !draft.categoryId || !draft.methodId) return;

      setResolvingIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        await resolveOne(item, draft);
        toast.success(`Resolved payment for ${item.payeeName}`);
        invalidateLedgerData();
      } catch (error) {
        if (isConflictError(error)) {
          toast.info('Row changed while you were working — refreshed, try again');
          invalidateLedgerData();
        } else {
          toast.error(error instanceof Error ? error.message : 'Failed to resolve transaction');
        }
      } finally {
        setResolvingIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [drafts, resolveOne, invalidateLedgerData]
  );

  const readyItems = useMemo(
    () => items.filter((item) => drafts[item.id]?.categoryId && drafts[item.id]?.methodId),
    [items, drafts]
  );

  const handleBulkResolve = useCallback(async () => {
    if (readyItems.length === 0) {
      toast.error('No items have a category selected yet');
      return;
    }

    setBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        readyItems.map((item) => resolveOne(item, drafts[item.id] ?? EMPTY_DRAFT))
      );
      const rejected = results.filter((entry) => entry.status === 'rejected') as PromiseRejectedResult[];
      const conflicts = rejected.filter((entry) => isConflictError(entry.reason));
      const resolvedCount = results.length - rejected.length;

      if (conflicts.length > 0) {
        toast.info(`${conflicts.length} row${conflicts.length > 1 ? 's' : ''} changed while working — refreshed, try those again`);
      }
      if (rejected.length === 0) {
        toast.success(`Resolved ${resolvedCount} payments`);
      } else if (conflicts.length < rejected.length) {
        const firstError = rejected.find((entry) => !isConflictError(entry.reason))?.reason;
        toast.warning(
          `Resolved ${resolvedCount}; ${rejected.length - conflicts.length} failed${firstError instanceof Error ? ` (${firstError.message})` : ''}`
        );
      }
      invalidateLedgerData();
    } finally {
      setBulkProcessing(false);
    }
  }, [readyItems, drafts, resolveOne, invalidateLedgerData]);

  const rememberedCount = useMemo(() => {
    return master?.payees.filter((p) => p.defaultCategoryId !== null).length || 0;
  }, [master]);

  // View tabs handling
  const handleViewChange = (viewId: string) => {
    setSavedView(viewId);
    setPage(1);
    if (viewId === 'today') {
      setDate(today);
      setReviewOnly(false);
      setIncludeVoided(false);
    } else if (viewId === 'review') {
      setReviewOnly(true);
      setIncludeVoided(false);
    } else if (viewId === 'voided') {
      setReviewOnly(false);
      setIncludeVoided(true);
    } else {
      setReviewOnly(false);
      setIncludeVoided(false);
    }
  };

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'review', label: 'Review Queue' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Transactions' },
    { id: 'voided', label: 'With Voided' }
  ];

  const isReview = savedView === 'review';

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{isReview ? 'Review Inbox' : 'Payment Ledger'}</h1>
      {hasError && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <span className="font-semibold">Connection Error:</span>
          <span>Unable to connect to the backend server. Please verify the server is running locally on port 4782.</span>
          <button onClick={() => refetchTransactions().catch(() => null)} className="ml-auto underline font-semibold hover:text-red-900">Retry</button>
        </div>
      )}

      {/* Segmented Control Tabs (Section 4.2 Spec) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SegmentedTabs options={tabs} activeId={savedView} onChange={handleViewChange} />
      </div>

      {isReview && (
        <div className="flex items-center justify-between gap-3 bg-white p-4 border border-[#DDE3EC] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2">
            {rememberedCount > 0 && (
              <div className="px-3 py-1.5 bg-[#E9F1FF] border border-[#165DFF]/30 text-[#165DFF] rounded-full text-xs font-bold flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>{rememberedCount} defaults saved</span>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <button
              onClick={handleBulkResolve}
              disabled={bulkProcessing || readyItems.length === 0}
              className="btn btn-primary h-10 px-4 gap-2 bg-[#F79009] hover:bg-[#D97706] border-none shadow-xs text-white"
            >
              <CheckCircle2 size={16} />
              <span>
                {bulkProcessing ? 'Processing...' : `Resolve all ready items${readyItems.length ? ` (${readyItems.length})` : ''}`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Combined Filter Bar (44px height inputs) */}
      {!isReview && (
        <div className="ledger-card p-4 bg-white border border-[#DDE3EC] rounded-2xl shadow-xs flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              type="text"
              name="ledger-search"
              aria-label="Search ledger"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search payee, category, amount, or note…"
              className="form-input form-input-with-icon"
            />
          </div>

          {/* Date Selector */}
          {dateApplies && (
            <div className="w-full md:w-48">
              <input
                type="date"
                name="ledger-date"
                aria-label="Ledger date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
                className="form-input font-medium"
              />
            </div>
          )}
        </div>
      )}

      {isReview ? (
        <div className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-[var(--shadow-card)]">
          <div className="divide-y divide-[#DDE3EC]">
            {items.length === 0 ? (
              <div className="p-12 text-center text-[#667085]">
                <Inbox size={40} className="mx-auto mb-3 text-emerald-500" />
                <h3 className="text-lg font-bold text-[#111827]">Review inbox is empty</h3>
                <p className="text-xs mt-1 text-[#667085]">
                  All incoming payments have been categorized and confirmed. Great work!
                </p>
              </div>
            ) : (
              items.map((item) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  draft={drafts[item.id] ?? EMPTY_DRAFT}
                  resolving={Boolean(resolvingIds[item.id])}
                  disabled={bulkProcessing}
                  categories={master?.categories ?? []}
                  methods={master?.paymentMethods ?? []}
                  onDraftChange={handleDraftChange}
                  onResolve={handleResolve}
                />
              ))
            )}
          </div>
          {items.length > 0 && (
            <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} />
          )}
        </div>
      ) : (
        /* Ledger Table Container */
        <div className="ledger-card bg-white p-0 border border-[#DDE3EC] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F8FC] border-b border-[#DDE3EC] text-xs uppercase font-bold text-[#667085]">
                <tr>
                  <th className="py-3.5 px-5">Date & Time</th>
                  <th className="py-3.5 px-5">Payee</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">Method</th>
                  <th className="py-3.5 px-5">Source</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#667085]">
                      <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-base">
                        {search ? 'No transactions match your search' : 'No transactions yet'}
                      </p>
                      <p className="text-xs mt-1">Try adjusting your filters or date selection.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isDigital = item.paymentMethodCode?.toLowerCase() !== 'cash';
                    const isVoided = item.status === 'voided';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedTx(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedTx(item);
                          }
                        }}
                        tabIndex={0}
                        className={`clickable-table-row transition-colors ${
                          isVoided ? 'opacity-50 bg-rose-50/20' : 'hover:bg-[#F6F8FC]'
                        }`}
                      >
                        {/* Date & Time */}
                        <td className="py-3.5 px-5 text-xs font-semibold text-[#667085]">
                          <div>{item.transactionDate}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatTime12(item.transactionTime)}</div>
                        </td>

                        {/* Payee with Avatar */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <PayeeAvatar name={item.payeeName} size={32} />
                            <div>
                              <span className="font-bold text-[#111827] block">{item.payeeName}</span>
                              {item.note && (
                                <span className="text-xs text-[#667085] truncate max-w-[200px] block">
                                  {item.note}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category Badge (Amber pill if empty) */}
                        <td className="py-3.5 px-5">
                          {item.categoryName ? (
                            <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-md">
                              {item.categoryName}
                            </span>
                          ) : (
                            <StatusPill variant="amber" label="Uncategorised" />
                          )}
                        </td>

                        {/* Method Badge */}
                        <td className="py-3.5 px-5">
                          {isDigital ? (
                            <StatusPill variant="blue" label={item.paymentMethodName || 'Digital/Bank'} />
                          ) : (
                            <StatusPill variant="gray" label="Cash" />
                          )}
                        </td>

                        {/* Muted 11px Monospace Source Badge */}
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 font-mono text-[11px] font-semibold text-[#667085] bg-slate-100 rounded border border-slate-200 uppercase">
                            {item.source}
                          </span>
                        </td>

                        {/* Fixed Right-Aligned Amount Column with 700 Weight & Tabular Nums */}
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
          <Pager page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>
      )}

      {/* Transaction Detail Drawer */}
      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
