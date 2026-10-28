import React from 'react';
import { IndianRupee, WalletCards, Factory, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCompactINR, formatInrFull } from '../../lib/format-inr';

interface KpiTotals {
  totalPaise: number;
  businessOperatingPaise: number;
  rawMaterialPaise: number;
  paymentCount: number;
  payeeCount: number;
  activeDayCount: number;
  averageTransactionPaise: number;
  needsReviewCount: number;
}

interface KpiGridProps {
  totals: KpiTotals;
  activeCategoryName?: string | undefined;
  onReviewClick?: (() => void) | undefined;
}

export function KpiGrid({ totals, activeCategoryName, onReviewClick }: KpiGridProps) {
  const totalOutflowPct =
    totals.totalPaise > 0
      ? Math.round((totals.rawMaterialPaise / totals.totalPaise) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* KPI 1 — Total Outflow (hero) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 border-t-4 border-t-red-500 shadow-2xs space-y-2 lg:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Outflow
          </span>
          <IndianRupee className="w-4 h-4 text-red-500 shrink-0" />
        </div>
        <div>
          <div className="text-3xl sm:text-4xl font-black tabular-nums text-slate-900" title={formatInrFull(totals.totalPaise)}>
            {formatCompactINR(totals.totalPaise)}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Across {totals.paymentCount} payment{totals.paymentCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* KPI 2 — Business Spend */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 border-t-4 border-t-blue-600 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Business Spend
          </span>
          <WalletCards className="w-4 h-4 text-blue-600 shrink-0" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900" title={formatInrFull(totals.businessOperatingPaise)}>
            {formatCompactINR(totals.businessOperatingPaise)}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Operating spend only</p>
        </div>
      </div>

      {/* KPI 3 — Raw Material / Contextual Category Spend */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 border-t-4 border-t-purple-600 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate mr-1">
            {activeCategoryName || 'Raw Material'}
          </span>
          <Factory className="w-4 h-4 text-purple-600 shrink-0" />
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900" title={formatInrFull(totals.rawMaterialPaise)}>
            {formatCompactINR(totals.rawMaterialPaise)}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {totalOutflowPct}% of total outflow
          </p>
        </div>
      </div>

      {/* KPI 4 — Payments & Review Status */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 border-t-4 border-t-emerald-600 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payments
          </span>
          <span className="text-xs font-semibold text-slate-500">
            Avg {formatCompactINR(totals.averageTransactionPaise)}
          </span>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900">
            {totals.paymentCount}
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            {totals.needsReviewCount > 0 ? (
              <button
                onClick={onReviewClick}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 cursor-pointer"
              >
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>{totals.needsReviewCount} need review</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>No review pending</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
