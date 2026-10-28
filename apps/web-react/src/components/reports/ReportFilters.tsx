import React, { useState } from 'react';
import { CalendarDays, Filter, X, Search } from 'lucide-react';
import { REPORT_GROUPS, type ReportGroup } from '../../lib/report-groups';

export type RangePreset = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'last-month' | 'last-30-days' | 'custom';

export interface ReportFilterState {
  preset: RangePreset;
  from: string;
  to: string;
  reportGroup: ReportGroup;
  categoryId?: number | undefined;
  payeeId?: number | undefined;
  needsReview?: boolean | undefined;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface PayeeOption {
  id: number;
  name: string;
}

interface ReportFiltersProps {
  filters: ReportFilterState;
  categories: CategoryOption[];
  payees: PayeeOption[];
  onFilterChange: (filters: Partial<ReportFilterState>) => void;
  onClearFilters: () => void;
}

export function ReportFilters({
  filters,
  categories,
  payees,
  onFilterChange,
  onClearFilters
}: ReportFiltersProps) {
  const [payeeSearch, setPayeeSearch] = useState('');
  const [payeeOpen, setPayeeOpen] = useState(false);

  const activeCategory = categories.find((c) => c.id === filters.categoryId);
  const activePayee = payees.find((p) => p.id === filters.payeeId);

  const filteredPayees = payees.filter((p) =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase())
  );

  const hasActiveFilters =
    filters.reportGroup !== 'All spending' ||
    filters.categoryId !== undefined ||
    filters.payeeId !== undefined ||
    filters.needsReview === true;

  return (
    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
      {/* Primary Filter Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date Presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <CalendarDays className="w-4 h-4 text-slate-400 mr-1 shrink-0" />
          {[
            { label: 'Today', key: 'today' },
            { label: 'Yesterday', key: 'yesterday' },
            { label: 'This Week', key: 'this-week' },
            { label: 'This Month', key: 'this-month' },
            { label: 'Last Month', key: 'last-month' },
            { label: 'Last 30 Days', key: 'last-30-days' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => onFilterChange({ preset: item.key as RangePreset })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors shrink-0 cursor-pointer ${
                filters.preset === item.key
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onFilterChange({ preset: 'custom', from: e.target.value })}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs font-semibold text-slate-400">TO</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onFilterChange({ preset: 'custom', to: e.target.value })}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Secondary Dropdown Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
        {/* Report Group */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Outflow Group
          </label>
          <select
            value={filters.reportGroup}
            onChange={(e) => onFilterChange({ reportGroup: e.target.value as ReportGroup })}
            className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {REPORT_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Category
          </label>
          <select
            value={filters.categoryId ?? ''}
            onChange={(e) =>
              onFilterChange({
                categoryId: e.target.value ? Number(e.target.value) : undefined
              })
            }
            className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payee Searchable Combobox */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Payee
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPayeeOpen(!payeeOpen)}
              className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate"
            >
              <span>{activePayee ? activePayee.name : 'All Payees'}</span>
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            </button>

            {payeeOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search payee..."
                    value={payeeSearch}
                    onChange={(e) => setPayeeSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
                  <button
                    onClick={() => {
                      onFilterChange({ payeeId: undefined });
                      setPayeeOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    All Payees
                  </button>
                  {filteredPayees.map((payee) => (
                    <button
                      key={payee.id}
                      onClick={() => {
                        onFilterChange({ payeeId: payee.id });
                        setPayeeOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        filters.payeeId === payee.id
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {payee.name}
                    </button>
                  ))}
                  {filteredPayees.length === 0 && (
                    <p className="p-2 text-xs text-slate-400 text-center">No payee found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500">Active Filters:</span>
          {filters.reportGroup !== 'All spending' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-full">
              Group: {filters.reportGroup}
              <button
                onClick={() => onFilterChange({ reportGroup: 'All spending' })}
                className="hover:text-blue-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {activeCategory && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-full">
              Category: {activeCategory.name}
              <button
                onClick={() => onFilterChange({ categoryId: undefined })}
                className="hover:text-purple-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {activePayee && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full">
              Payee: {activePayee.name}
              <button
                onClick={() => onFilterChange({ payeeId: undefined })}
                className="hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.needsReview && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full">
              Needs Review
              <button
                onClick={() => onFilterChange({ needsReview: undefined })}
                className="hover:text-amber-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={onClearFilters}
            className="text-xs font-bold text-slate-500 hover:text-red-600 underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
