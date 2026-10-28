import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryString, istToday, MasterData } from '../api/client';
import { Download, Calendar, Filter, FileSpreadsheet, RotateCcw, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function ExportPage() {
  const [dateMode, setDateMode] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'all' | 'posted' | 'voided' | 'review'>('all');
  const [payeeId, setPayeeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [search, setSearch] = useState('');

  // Fetch master data for filter dropdowns
  const { data: master } = useQuery<MasterData>({
    queryKey: ['master-data-all'],
    queryFn: () => api<MasterData>('/master-data?includeInactive=true')
  });

  const payeesList = useMemo(() => {
    return master?.payees || [];
  }, [master]);

  const categoriesList = useMemo(() => {
    return master?.categories || [];
  }, [master]);

  const methodsList = useMemo(() => {
    return master?.paymentMethods || [];
  }, [master]);

  const buildParams = () => {
    const today = istToday();
    let from: string | undefined;
    let to: string | undefined;
    let dateVal: string | undefined;

    if (dateMode === 'today') {
      dateVal = today;
    } else if (dateMode === 'month') {
      from = `${today.slice(0, 8)}01`;
      to = today;
    } else if (dateMode === 'custom') {
      from = startDate || undefined;
      to = endDate || undefined;
    }

    return queryString({
      date: dateVal,
      from,
      to,
      search: search.trim() || undefined,
      payeeId: payeeId ? Number(payeeId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      methodId: methodId ? Number(methodId) : undefined,
      includeVoided: status === 'all' ? true : false,
      voidedOnly: status === 'voided' ? true : false,
      reviewOnly: status === 'review' ? true : false
    });
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const params = buildParams();
    window.open(`/api/export/transactions.${format}${params}`, '_blank');
    toast.success(format === 'xlsx' ? 'Generating Excel workbook... Check your downloads.' : 'Generating CSV export... Check your downloads.');
  };

  const clearFilters = () => {
    setDateMode('all');
    setStartDate('');
    setEndDate('');
    setStatus('all');
    setPayeeId('');
    setCategoryId('');
    setMethodId('');
    setSearch('');
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="sr-only">Export transactions</h1>
      <div className="ledger-card overflow-hidden bg-white p-0 border border-[#DDE3EC] rounded-2xl shadow-xs">
        <div className="grid lg:grid-cols-[1fr_1.15fr]">
        {/* Date Range Selection */}
        <section className="space-y-4 border-b border-[#DDE3EC] p-5 lg:border-b-0 lg:border-r">
          <label className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
            <Calendar size={14} className="text-[#165DFF]" />
            <span>Date range</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            {(['all', 'today', 'month', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDateMode(mode)}
                className={`btn h-10 text-xs font-bold capitalize cursor-pointer ${
                  dateMode === mode ? 'btn-primary text-white' : 'btn-secondary'
                }`}
              >
                {mode === 'all' ? 'All Time' : mode === 'month' ? 'This Month' : mode}
              </button>
            ))}
          </div>

          <div className={`grid grid-cols-2 gap-3 ${dateMode === 'custom' ? '' : 'opacity-45'}`}>
              <div>
                <label className="text-[10px] font-bold text-[#667085] block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={dateMode !== 'custom'}
                  className="form-input text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#667085] block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={dateMode !== 'custom'}
                  className="form-input text-xs"
                />
              </div>
          </div>
          <div className="rounded-xl border border-[#DDE3EC] bg-[#F8FAFD] p-4 text-xs text-[#667085]">
            <FileSpreadsheet size={18} className="mb-2 text-[#165DFF]" />
            Excel includes a formatted Transactions sheet with totals, a formula-linked Summary breakdown, a Review sheet, and an Info sheet. CSV contains the raw rows.
          </div>
        </section>

        {/* Filters */}
        <section className="space-y-4 p-5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
            <Filter size={14} className="text-[#165DFF]" />
            <span>Transaction filters</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Payee</label>
              <select
                value={payeeId}
                onChange={(e) => setPayeeId(e.target.value)}
                className="form-input text-xs"
              >
                <option value="">All Payees</option>
                {payeesList.map((p) => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Transaction Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="form-input text-xs"
              >
                <option value="all">All Transactions (include Voided)</option>
                <option value="posted">Posted Only</option>
                <option value="voided">Voided Only</option>
                <option value="review">Needs Review Only</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="form-input text-xs"
              >
                <option value="">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Payment Method</label>
              <select
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                className="form-input text-xs"
              >
                <option value="">All Methods</option>
                {methodsList.map((m) => (
                  <option key={m.id} value={m.id.toString()}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[#667085] block mb-1">Search payee or note</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search matches..."
              className="form-input text-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#DDE3EC] pt-4">
            <button type="button" onClick={clearFilters} className="btn btn-secondary h-10 gap-2 px-3 text-xs"><RotateCcw size={14} />Clear</button>
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport('csv')} className="btn btn-secondary h-10 px-4 gap-2 text-xs cursor-pointer">
                <FileText size={15} />
                <span>CSV</span>
              </button>
              <button onClick={() => handleExport('xlsx')} className="btn btn-primary h-10 px-5 gap-2 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white cursor-pointer text-sm shadow-sm">
                <Download size={16} />
                <span>Download Excel</span>
              </button>
            </div>
          </div>
        </section>

        </div>
      </div>
    </div>
  );
}
