import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  api,
  post,
  formatInr,
  formatTime12,
  DashboardData,
  MasterData,
  QuickPreview,
  QuickSaveResult,
  LedgerTransaction,
  Payee
} from '../api/client';
import { ApiError } from '../api/client';
import Fuse from 'fuse.js';
import {
  Search,
  AlertTriangle,
  CreditCard,
  Banknote,
  Inbox,
  Star,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import QuickReviewModal from '../components/review/QuickReviewModal';
import { PayeeAvatar } from '../components/common/PayeeAvatar';
import { StatusPill } from '../components/common/StatusPill';
import { TransactionDrawer } from '../components/common/TransactionDrawer';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { HeroStatCard } from '../components/common/HeroStatCard';
import { useVoidTransaction } from '../hooks/use-void-transaction';

export default function TodayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const voidTransaction = useVoidTransaction();
  const [command, setCommand] = useState('');
  const [preview, setPreview] = useState<QuickPreview | null>(null);
  const [previewCommand, setPreviewCommand] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [categorySuggestionIndex, setCategorySuggestionIndex] = useState(-1);

  // Confirmation / Edit States
  const [drawerInitialEdit, setDrawerInitialEdit] = useState(false);
  const [voidConfirmTx, setVoidConfirmTx] = useState<LedgerTransaction | null>(null);
  // Inline save gates: only shown when something genuinely needs a second Enter
  const [saveGate, setSaveGate] = useState<
    { kind: 'new-payee' | 'duplicate'; message: string } | null
  >(null);

  const [showSuggestions, setShowSuggestions] = useState(false);


  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LedgerTransaction | null>(null);
  const [reviewTransaction, setReviewTransaction] = useState<{
    id: number;
    updatedAt: string;
    payeeId?: number;
    amountPaise?: number;
    payeeName?: string;
    categoryId?: number | null;
    paymentMethodId?: number | null;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | undefined>(undefined);

  // Queries
  const {
    data: dashboard,
    isError: dashboardError,
    refetch: refetchDashboard
  } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard')
  });

  const { data: master, isError: masterError, refetch: refetchMaster } = useQuery<MasterData>({
    queryKey: ['master-data'],
    queryFn: () => api<MasterData>('/master-data')
  });

  const todayDate = dashboard?.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  const {
    data: transactionsData,
    isError: transactionsError,
    refetch: refetchTransactions
  } = useQuery<{ items: LedgerTransaction[] }>({
    queryKey: ['transactions', todayDate],
    queryFn: () => api<{ items: LedgerTransaction[] }>(`/transactions?date=${todayDate}&pageSize=100`),
    enabled: !!todayDate
  });

  const todaysItems = transactionsData?.items || [];
  const hasError = dashboardError || masterError || transactionsError;
  const hasAmountInput = useMemo(
    () => /(?:^|\s)(?:\d+(?:[.,]\d+)?|\.\d+)\s*(?:k|l|lac|lakh)?(?=\s|$)/i.test(command),
    [command]
  );
  const categorySuggestions = master?.categories ?? [];
  const categoryChooserVisible = Boolean(
    preview && hasAmountInput && preview.needsReview && !preview.categoryId && categorySuggestions.length
  );

  const { data: lastPaymentData } = useQuery<{ items: LedgerTransaction[] }>({
    queryKey: ['payee-last-payment', preview?.payeeId],
    queryFn: () => api<{ items: LedgerTransaction[] }>(`/transactions?payeeId=${preview!.payeeId}&pageSize=1`),
    enabled: Boolean(preview?.payeeId)
  });
  const lastPayment = lastPaymentData?.items[0];

  const handleRefresh = async () => {
    await Promise.all([refetchDashboard().catch(() => null), refetchMaster().catch(() => null), refetchTransactions().catch(() => null)]);
    toast.success('Today data refreshed');
  };

  // Google-style ranking: strong prefix matches first, then favourites and usage.
  const commandPayeeSuggestions = useMemo(() => {
    const trimmed = command.trim();
    if (!trimmed || !master?.payees) return [];
    
    // Extract the text token before any numbers (amount)
    const textToken = command.split(/\d/)[0]?.trim() || trimmed;
    
    if (textToken.length > 0) {
      const fuse = new Fuse(master.payees, {
        keys: [
          { name: 'name', weight: 0.76 },
          { name: 'aliases', weight: 0.24 }
        ],
        threshold: 0.46,
        distance: 80,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 1
      });
      const query = textToken.toLocaleLowerCase('en-IN');
      return fuse.search(textToken)
        .sort((left, right) => {
          const leftPrefix = left.item.name.toLocaleLowerCase('en-IN').startsWith(query) ? 1 : 0;
          const rightPrefix = right.item.name.toLocaleLowerCase('en-IN').startsWith(query) ? 1 : 0;
          if (leftPrefix !== rightPrefix) return rightPrefix - leftPrefix;
          if (left.item.favourite !== right.item.favourite) return Number(right.item.favourite) - Number(left.item.favourite);
          const usageDifference = right.item.paymentCount - left.item.paymentCount;
          if (usageDifference !== 0) return usageDifference;
          return (left.score ?? 1) - (right.score ?? 1);
        })
        .map((result) => result.item)
        .slice(0, 4);
    }
    
    return master.payees.slice(0, 6);
  }, [command, master?.payees]);

  // Handle Quick Entry input & live preview
  useEffect(() => {
    window.clearTimeout(previewTimerRef.current);
    setSuggestionIndex(-1);
    setSaveGate(null);

    if (!command.trim()) {
      setPreview(null);
      setPreviewCommand('');
      setShowSuggestions(false);
      return;
    }

    const payeePrefix = command.split(/\d/)[0]?.trim() ?? '';
    const normalizedPayeePrefix = payeePrefix.toLocaleLowerCase('en-IN');
    const exactPayee = master?.payees.some((payee) =>
      [payee.name, ...payee.aliases].some(
        (name) => name.toLocaleLowerCase('en-IN') === normalizedPayeePrefix
      )
    );
    setShowSuggestions(
      Boolean(payeePrefix) &&
      !exactPayee &&
      !hasAmountInput
    );

    previewTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await post<QuickPreview>('/quick-entry/preview', { command });
        setPreview(res);
        setPreviewCommand(command.trim());
      } catch {
        setPreview(null);
        setPreviewCommand('');
      }
    }, 120);

    return () => window.clearTimeout(previewTimerRef.current);
  }, [command, master?.payees, hasAmountInput, commandPayeeSuggestions.length]);

  useEffect(() => {
    if (suggestionIndex < 0) return;
    document
      .getElementById(`payee-suggestion-${suggestionIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [suggestionIndex]);

  const executeSave = async (dupConfirmed: boolean) => {
    if (!command.trim() || saving) return;
    setSaving(true);
    try {
      const res = await post<QuickSaveResult>('/quick-entry/save', {
        command,
        confirmNewPayee: true,
        confirmDuplicate: dupConfirmed
      });

      if (res.testRun || !res.transaction) {
        const savedPreview = preview;
        toast.info('TEST MODE — nothing was saved', {
          description: `${formatInr(savedPreview?.amountPaise ?? 0)} · ${savedPreview?.payeeName || ''}${
            res.duplicate && res.duplicateReason ? ` · ⚠️ ${res.duplicateReason}` : ' · would be recorded normally'
          }`,
          duration: 6000
        });
        setCommand('');
        setPreview(null);
        setPreviewCommand('');
        setShowSuggestions(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      const saved = res.transaction;
      toast.success(`${formatInr(saved.amountPaise)} paid to ${saved.payeeName}`, {
        description: `${saved.categoryName || 'Uncategorised'} · ${saved.paymentMethodName || 'Cash'} · ${formatTime12(saved.transactionTime)}`
      });
      setCommand('');
      setPreview(null);
      setPreviewCommand('');
      setShowSuggestions(false);
      await queryClient.invalidateQueries();

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if ((error instanceof ApiError && error.code === 'DUPLICATE_TRANSACTION') || msg.toLowerCase().includes('duplicate')) {
        setSaveGate({ kind: 'duplicate', message: `${msg} — Enter again to save anyway` });
      } else if (msg.toLowerCase().includes('payee')) {
        toast.error('New payee detected. Press Enter again to confirm.');
      } else {
        toast.error(msg || 'Failed to record payment');
      }
    } finally {
      setSaving(false);
    }
  };

  const applyPayeeSuggestion = (payee: Payee) => {
    // Replace the text portion with the selected payee name and append a space
    const amountMatch = command.match(/\d.*/);
    const amountPart = amountMatch ? ` ${amountMatch[0]}` : ' ';
    setCommand(`${payee.name}${amountPart}`);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const applyCategorySuggestion = (category: MasterData['categories'][number]) => {
    setCommand((current) => `${current.trim()} ${category.name}`);
    setCategorySuggestionIndex(-1);
    inputRef.current?.focus();
  };

  const addNoteToken = () => {
    const existingQuote = command.indexOf('"');
    if (existingQuote >= 0) {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(existingQuote + 1, existingQuote + 1);
      return;
    }
    setCommand((current) => `${current.trim()} ""`);
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const caret = Math.max(0, input.value.length - 1);
      input.setSelectionRange(caret, caret);
    }, 0);
  };

  const handleSaveAttempt = () => {
    if (preview?.errors.length) {
      toast.error(preview.errors[0]);
      return;
    }

    if (!preview?.valid || previewCommand !== command.trim()) return;

    // Only gate when creating a payee needs confirmation; duplicates are gated
    // after the server flags them. Everything else saves instantly.
    if (!saveGate && preview.isNewPayee) {
      setSaveGate({
        kind: 'new-payee',
        message: `New payee "${preview.payeeName}" will be created — Enter again to confirm`
      });
      return;
    }
    void executeSave(saveGate?.kind === 'duplicate');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && commandPayeeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev + 1) % commandPayeeSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex((prev) => prev < 0 ? commandPayeeSuggestions.length - 1 : (prev - 1 + commandPayeeSuggestions.length) % commandPayeeSuggestions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
        const selected = commandPayeeSuggestions[idx];
        if (selected) applyPayeeSuggestion(selected);
        return;
      }
    }

    if (categoryChooserVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCategorySuggestionIndex((previous) => (previous + 1) % categorySuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCategorySuggestionIndex((previous) => previous < 0
          ? categorySuggestions.length - 1
          : (previous - 1 + categorySuggestions.length) % categorySuggestions.length);
        return;
      }
      if ((e.key === 'Tab' || e.key === 'Enter') && categorySuggestionIndex >= 0) {
        e.preventDefault();
        const selected = categorySuggestions[categorySuggestionIndex];
        if (selected) applyCategorySuggestion(selected);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (e.ctrlKey) {
        if (preview?.valid && (!preview?.errors || preview.errors.length === 0)) {
          executeSave(true);
        }
        return;
      }

      // A visible suggestion must be accepted before saving, including typo corrections
      // after an amount has already been entered. Escape keeps the text as a new payee.
      if (showSuggestions && commandPayeeSuggestions.length > 0) {
        const idx = suggestionIndex >= 0 ? suggestionIndex : 0;
        const selected = commandPayeeSuggestions[idx];
        if (selected) {
          applyPayeeSuggestion(selected);
          return;
        }
      }

      handleSaveAttempt();
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setCategorySuggestionIndex(-1);
      setSaveGate(null);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-full space-y-4">
      <h1 className="sr-only">Today</h1>
      {hasError && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <span className="font-semibold">Connection Error:</span>
          <span>Unable to connect to the backend server. Please verify the server is running locally on port 4782.</span>
          <button onClick={handleRefresh} className="ml-auto underline font-semibold hover:text-red-900">Retry</button>
        </div>
      )}
      <section className="relative rounded-2xl border border-[#DDE3EC] bg-white px-4 py-4 shadow-[var(--shadow-card)] md:px-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-[#111827]">Record payment</h1>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            { label: 'Date', value: preview?.transactionDate === todayDate || !preview?.transactionDate ? 'Today' : preview.transactionDate, tone: preview?.transactionDate ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400', isNew: false },
            { label: 'Payee', value: preview?.payeeName || 'Not selected', tone: preview?.payeeName ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-400', isNew: Boolean(preview?.isNewPayee) },
            { label: 'Amount', value: preview?.amountPaise ? formatInr(preview.amountPaise) : '—', tone: preview?.amountPaise ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400', isNew: false },
            { label: 'Category', value: preview?.categoryName || 'Not selected', tone: preview?.categoryName ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400', isNew: false },
            { label: 'Type', value: preview?.paymentMethodName || 'Not selected', tone: preview?.paymentMethodName ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-400', isNew: false },
            { label: 'Last paid', value: lastPayment ? `${formatInr(lastPayment.amountPaise)} · ${lastPayment.transactionDate}` : preview?.payeeId ? 'No previous payment' : 'Select payee', tone: lastPayment ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400', isNew: false }
          ].map(({ label, value, tone, isNew }) => (
            <div key={label} className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs ${tone}`}>
              <span className="opacity-75">{label}</span><strong className="max-w-52 truncate font-semibold">{value}</strong>
              {isNew && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">New</span>}
            </div>
          ))}
        </div>

        {/* Main Quick Entry Input Container */}
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-4.5 text-[#165DFF]"><Search size={22} className="stroke-[2.5]" /></div>
            <input
              ref={inputRef}
              type="text"
              name="quick-entry-input"
              aria-label="Quick payment input"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && commandPayeeSuggestions.length > 0}
              aria-controls="payee-listbox"
              aria-activedescendant={suggestionIndex >= 0 ? `payee-suggestion-${suggestionIndex}` : undefined}
              autoComplete="off"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (command.trim() && !/\d/.test(command)) setShowSuggestions(true);
              }}
              placeholder="Payee, amount, method and purpose…"
              className="w-full h-12 pl-13 pr-5 text-base font-semibold rounded-lg border border-slate-300 focus-visible:border-[#165DFF] focus-visible:ring-3 focus-visible:ring-[#165DFF]/12 bg-white text-[#111827] placeholder:text-slate-400 transition-all"
            />
          </div>

          {preview && command.trim() && (
            <div className="sr-only">
              <span>Parsed payment</span>
              <strong>{preview.payeeName} · {preview.amountPaise === null ? '—' : formatInr(preview.amountPaise)}</strong>
            </div>
          )}

          {/* Inline save gate — only for new payees and flagged duplicates */}
          <AnimatePresence>
            {saveGate && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                role="alert"
                className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-amber-800">
                  <AlertTriangle size={13} className="mr-1.5 inline shrink-0 align-[-2px]" />
                  {saveGate.message}
                </p>
                <button
                  type="button"
                  onClick={() => setSaveGate(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 cursor-pointer"
                >
                  Esc cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optional category chooser for incomplete payments */}
          <AnimatePresence>
            {categoryChooserVisible ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 rounded-lg border border-[#DDE3EC] bg-[#F8FAFC] px-3 py-2.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#475467]">Category <span className="font-normal text-[#98A2B3]">(optional)</span></p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Skip → Review</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                  {categorySuggestions.map((category) => {
                    const categoryIndex = categorySuggestions.findIndex((item) => item.id === category.id);
                    const isFocused = categoryIndex === categorySuggestionIndex;
                    return (
                    <button
                      type="button"
                      key={category.id}
                      onClick={() => applyCategorySuggestion(category)}
                      onMouseEnter={() => setCategorySuggestionIndex(categoryIndex)}
                      onFocus={() => setCategorySuggestionIndex(categoryIndex)}
                      className={`min-w-0 rounded-lg border px-2.5 py-2 text-left shadow-sm transition ${isFocused
                        ? 'border-[#165DFF] bg-[#E9F1FF] text-[#165DFF] shadow-[#165DFF]/10'
                        : 'border-[#DDE3EC] bg-white text-[#475467] hover:border-[#9DBBFF] hover:bg-[#F5F8FF]'
                      }`}
                    >
                      <span className="block truncate text-xs font-bold">{category.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] font-normal text-[#667085]">{category.note || 'No description'}</span>
                    </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Compact dynamic assistant */}
          <AnimatePresence>
            {showSuggestions && commandPayeeSuggestions.length > 0 && (
              <motion.div
                ref={dropdownRef}
                id="payee-listbox"
                role="listbox"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.12 }}
                className="mt-2 border-t border-[#E5E7EB] pt-2"
              >
                <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-[#667085]">
                  <span className="font-semibold">
                    {(command.split(/\d/)[0] ?? '').trim().split(/\s+/).length > 1
                      ? `Did you mean ${commandPayeeSuggestions[0]?.name}?`
                      : 'Matching payees'}
                  </span>
                  <span>↑↓ choose · Tab or Enter select · Esc keep new name</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
                  {commandPayeeSuggestions.map((payee, idx) => {
                    const isSelected = idx === suggestionIndex;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        id={`payee-suggestion-${idx}`}
                        key={payee.id}
                        onClick={() => applyPayeeSuggestion(payee)}
                        onMouseEnter={() => setSuggestionIndex(idx)}
                        className={`min-w-0 rounded-lg border px-3 py-2 text-left shadow-sm transition-colors ${
                          isSelected
                            ? 'border-[#165DFF] bg-[#E9F1FF] text-[#165DFF] shadow-[#165DFF]/10'
                            : 'border-[#DDE3EC] bg-white text-[#111827] hover:border-[#9DBBFF] hover:bg-[#F5F8FF]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{payee.name}</span>
                          {payee.favourite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-500" />}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#667085]">
                          {payee.paymentCount} payments
                          {payee.defaultCategoryId ? ` · ${master?.categories.find((category) => category.id === payee.defaultCategoryId)?.name}` : ''}
                          {payee.defaultPaymentMethodId ? ` · ${master?.paymentMethods.find((method) => method.id === payee.defaultPaymentMethodId)?.displayName}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {command.trim() && !showSuggestions && preview?.categoryId && (
          <div className="mt-2 grid gap-1.5 border-t border-[#E5E7EB] pt-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 shadow-sm">
              <strong className="block text-[#344054]">Type</strong>
              <span className="mt-0.5 block text-[11px] text-[#667085]">Write cash, UPI, bank, or cheque.</span>
            </div>
            <div className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 shadow-sm">
              <strong className="block text-[#344054]">Date</strong>
              <span className="mt-0.5 block text-[11px] text-[#667085]">Write yesterday, 28-June, or 21/7.</span>
            </div>
            <button
              type="button"
              onClick={addNoteToken}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#9DBBFF] hover:bg-[#F5F8FF]"
            >
              <strong className="block text-[#344054]">Note</strong>
              <span className="mt-0.5 block text-[11px] text-[#667085]">Use "" or // to add a note. Click to {command.includes('"') ? 'edit' : 'insert quotes'}.</span>
            </button>
          </div>
        )}
        {!command.trim() && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
            <span>Try:</span>
            {[
              'Vijay Patel 2500',
              'Ramesh Kumar 1200 cash wages',
              'Mahesh Transport 5000 bank transport'
            ].map((example) => (
              <button key={example} type="button" onClick={() => setCommand(example)} className="rounded-md bg-slate-100 px-2 py-1 text-[#475467] hover:bg-[#E9F1FF] hover:text-[#165DFF]">{example}</button>
            ))}
            <span className="ml-auto">Tab completes · Enter saves</span>
          </div>
        )}
      </section>

      {/* SECTION 2: SUMMARY CARDS LAYOUT */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <HeroStatCard
          isHero
          title="Total outgoing today"
          amountPaise={dashboard?.totalOutgoingPaise || 0}
          subtitle={`${dashboard?.paymentCount || 0} payments today`}
          accentColor="red"
          className="col-span-2 p-4 lg:col-span-2"
        />
        <div className="ledger-card p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#667085]"><Banknote size={14} /> Cash</span>
          <strong className="mt-1 block tabular-nums text-lg text-[#111827]">{formatInr(dashboard?.cashPaise || 0)}</strong>
          <span className="mt-1 block text-xs text-[#667085]">Physical payments</span>
        </div>
        <div className="ledger-card p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#667085]"><CreditCard size={14} /> Bank / digital</span>
          <strong className="mt-1 block tabular-nums text-lg text-[#111827]">{formatInr(dashboard?.digitalPaise || 0)}</strong>
          <span className="mt-1 block text-xs text-[#667085]">UPI, bank and cheque</span>
        </div>
        <button onClick={() => navigate('/review')} className="ledger-card p-4 text-left hover:border-amber-300 hover:shadow-md">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#667085]"><AlertTriangle size={14} /> Needs review</span>
          <strong className={`mt-1 block tabular-nums text-lg ${dashboard?.reviewCount ? 'text-amber-700' : 'text-[#111827]'}`}>{dashboard?.reviewCount || 0}</strong>
          <span className="mt-1 block text-xs text-[#667085]">Open review queue</span>
        </button>
      </div>

      {dashboard && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-xs text-[#667085]">
          <span>Largest today <strong className="text-[#111827]">{formatInr(dashboard.largestPaymentPaise)}</strong></span>
          <span><strong className="text-[#111827]">{dashboard.uniquePayeeCount}</strong> unique payees</span>
          <span>Month <strong className="text-[#111827]">{formatInr(dashboard.monthTotalPaise)}</strong></span>
          <span>Average active day <strong className="text-[#111827]">{formatInr(dashboard.averageActiveDayPaise)}</strong></span>
        </div>
      )}

      {/* SECTION 3: OUTLAY LEDGER TABLE */}
      <div className="ledger-card bg-white p-0 border border-[#DDE3EC] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="notion-table table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[29%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Payee</th>
                <th>Category</th>
                <th className="text-center">Method</th>
                <th className="text-center">Status</th>
                <th className="text-right">Money</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE3EC]">
              {todaysItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#667085]">
                    <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">No payments recorded today</p>
                    <p className="text-xs mt-1">Use the quick entry bar above to log a payment.</p>
                  </td>
                </tr>
              ) : (
                todaysItems.map((item) => {
                  const isVoided = item.status === 'voided';
                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open payment to ${item.payeeName} for ${formatInr(item.amountPaise)}`}
                      onClick={() => {
                        setDrawerInitialEdit(false);
                        setSelectedTransaction(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDrawerInitialEdit(false);
                          setSelectedTransaction(item);
                        }
                      }}
                      className="hover:bg-[#F6F8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#165DFF] cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-5 text-xs text-[#667085] font-semibold whitespace-nowrap">
                        Today, {formatTime12(item.transactionTime)}
                      </td>
                      <td className="py-3.5 px-5 overflow-hidden">
                        <div className="flex items-center gap-2.5">
                          <PayeeAvatar name={item.payeeName} size={30} />
                          <div className="min-w-0">
                            <span className="block truncate font-bold text-[#111827] group-hover:text-[#165DFF] transition-colors text-sm">
                              {item.payeeName}
                            </span>
                            {item.note && (
                              <p className="text-xs text-[#667085] line-clamp-1 mt-0.5">
                                {item.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {item.categoryName ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 rounded-md">
                            {item.categoryName}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                            Uncategorised
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="text-xs font-medium text-slate-700">{item.paymentMethodName || 'Cash'}</span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <StatusPill
                          variant={item.status === 'voided' ? 'gray' : item.needsReview ? 'amber' : 'green'}
                          label={item.status === 'voided' ? 'Voided' : item.needsReview ? 'Review' : 'Posted'}
                        />
                      </td>
                      <td className="py-3.5 px-5 text-right font-black tabular-nums text-base text-[#111827]">
                        {isVoided && <span className="line-through text-rose-500 mr-2">{formatInr(item.amountPaise)}</span>}
                        {!isVoided && formatInr(item.amountPaise)}
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setDrawerInitialEdit(true);
                              setSelectedTransaction(item);
                            }}
                            className="p-1.5 text-slate-500 hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Edit transaction"
                            aria-label={`Edit payment to ${item.payeeName}`}
                            disabled={isVoided}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setVoidConfirmTx(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Void transaction"
                            aria-label={`Void payment to ${item.payeeName}`}
                            disabled={isVoided}
                          >
                            <Trash2 size={14} />
                          </button>
                          {item.needsReview && (
                            <button
                              onClick={() => {
                                setReviewTransaction(item);
                                setReviewOpen(true);
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors cursor-pointer"
                              title="Review transaction rules"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Drawers */}
      {selectedTransaction && (
        <TransactionDrawer
          transaction={selectedTransaction}
          initialEdit={drawerInitialEdit}
          onClose={() => {
            setSelectedTransaction(null);
            setDrawerInitialEdit(false);
          }}
        />
      )}



      {reviewOpen && reviewTransaction && (
        <QuickReviewModal
          open={reviewOpen}
          onClose={() => {
            setReviewOpen(false);
            setReviewTransaction(null);
          }}
          transaction={reviewTransaction}
          master={master!}
          onSaved={handleRefresh}
        />
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!voidConfirmTx}
        title="Void this Transaction?"
        description="The payment is marked voided and excluded from totals. You can undo from the toast for a few seconds, and it stays visible with 'With Voided'."
        type="danger"
        confirmText="Void Transaction"
        previewData={voidConfirmTx ? {
          'Payee': voidConfirmTx.payeeName,
          'Amount': formatInr(voidConfirmTx.amountPaise),
          'Category': voidConfirmTx.categoryName || 'Uncategorised',
          'Payment Method': voidConfirmTx.paymentMethodName || 'Cash',
          'Date': `Today, ${formatTime12(voidConfirmTx.transactionTime)}`,
          'Note': voidConfirmTx.note || 'None'
        } : undefined}
        onConfirm={async () => {
          if (!voidConfirmTx) return;
          const target = voidConfirmTx;
          setVoidConfirmTx(null);
          await voidTransaction({
            id: target.id,
            payeeName: target.payeeName,
            amountPaise: target.amountPaise,
            reason: 'Voided from Today after user review'
          });
        }}
        onCancel={() => setVoidConfirmTx(null)}
      />
    </div>
  );
}