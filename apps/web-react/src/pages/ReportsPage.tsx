import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, queryString } from '../api/client';
import { AlertCircle } from 'lucide-react';

import {
  ReportFilters,
  ReportFilterState,
  RangePreset
} from '../components/reports/ReportFilters';
import { KpiGrid } from '../components/reports/KpiGrid';
import { CashOutflowTrend } from '../components/reports/CashOutflowTrend';
import { OutflowTypeCard } from '../components/reports/OutflowTypeCard';
import { CategorySpendChart } from '../components/reports/CategorySpendChart';
import { TopPayeesCard } from '../components/reports/TopPayeesCard';
import { ReportSkeletons } from '../components/reports/ReportSkeletons';
import { ReportGroup } from '../lib/report-groups';

interface ReportsApiResponse {
  from: string;
  to: string;
  totals: {
    totalPaise: number;
    businessOperatingPaise: number;
    rawMaterialPaise: number;
    paymentCount: number;
    payeeCount: number;
    activeDayCount: number;
    averageTransactionPaise: number;
    needsReviewCount: number;
  };
  outflowGroups: Array<{
    groupName: string;
    amountPaise: number;
    transactionCount: number;
    percentage: number;
  }>;
  daily: Array<{
    label: string;
    totalPaise: number;
    paymentCount: number;
    cashPaise?: number;
    nonCashPaise?: number;
    businessOperatingPaise?: number;
  }>;
  categories: Array<{
    categoryId?: number | undefined;
    label: string;
    totalPaise: number;
    paymentCount: number;
    averageTransactionPaise?: number | undefined;
  }>;
  payees: Array<{
    id: number;
    label: string;
    type: string;
    totalPaise: number;
    paymentCount: number;
  }>;
}

interface MasterDataResponse {
  categories: Array<{ id: number; name: string }>;
  payees: Array<{ id: number; name: string }>;
}

function getTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function computePresetDates(preset: RangePreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const todayStr = getTodayString();
  const todayDate = new Date(`${todayStr}T00:00:00Z`);

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }

  if (preset === 'yesterday') {
    const y = new Date(todayDate);
    y.setUTCDate(y.getUTCDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    return { from: yStr, to: yStr };
  }

  if (preset === 'this-week') {
    const startOfWeek = new Date(todayDate);
    const day = startOfWeek.getUTCDay();
    const diff = (day + 6) % 7; // Monday start
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);
    return { from: startOfWeek.toISOString().slice(0, 10), to: todayStr };
  }

  if (preset === 'this-month') {
    return { from: `${todayStr.slice(0, 8)}01`, to: todayStr };
  }

  if (preset === 'last-month') {
    const prevMonthDate = new Date(todayDate);
    prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
    const year = prevMonthDate.getUTCFullYear();
    const month = String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, Number(month), 0)).getUTCDate();
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
  }

  if (preset === 'last-30-days') {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }

  return {
    from: customFrom || `${todayStr.slice(0, 8)}01`,
    to: customTo || todayStr
  };
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL search params
  const initialPreset = (searchParams.get('preset') as RangePreset) || 'this-month';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';
  const initialGroup = (searchParams.get('group') as ReportGroup) || 'All spending';
  const initialCategoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;
  const initialPayeeId = searchParams.get('payee') ? Number(searchParams.get('payee')) : undefined;
  const initialNeedsReview = searchParams.get('review') === 'true' ? true : undefined;

  const defaultDates = computePresetDates(initialPreset, initialFrom, initialTo);

  const [filters, setFilters] = useState<ReportFilterState>({
    preset: initialPreset,
    from: defaultDates.from,
    to: defaultDates.to,
    reportGroup: initialGroup,
    categoryId: initialCategoryId,
    payeeId: initialPayeeId,
    needsReview: initialNeedsReview
  });

  // Update URL search parameters when filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.preset !== 'this-month') params.preset = filters.preset;
    if (filters.preset === 'custom') {
      params.from = filters.from;
      params.to = filters.to;
    }
    if (filters.reportGroup !== 'All spending') params.group = filters.reportGroup;
    if (filters.categoryId !== undefined) params.category = String(filters.categoryId);
    if (filters.payeeId !== undefined) params.payee = String(filters.payeeId);
    if (filters.needsReview) params.review = 'true';

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Fetch Master Data (Categories & Payees) for Filters
  const { data: masterData } = useQuery<MasterDataResponse>({
    queryKey: ['master-data'],
    queryFn: () => api<MasterDataResponse>('/master-data'),
    staleTime: 300000
  });

  // Fetch Reports Aggregated Overview
  const reportQueryString = queryString({
    from: filters.from,
    to: filters.to,
    ...(filters.reportGroup !== 'All spending' ? { reportGroup: filters.reportGroup } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.payeeId ? { payeeId: filters.payeeId } : {}),
    ...(filters.needsReview ? { needsReview: 'true' } : {})
  });

  const {
    data: reportData,
    isLoading: reportLoading,
    isError: reportError,
    refetch: refetchReport
  } = useQuery<ReportsApiResponse>({
    queryKey: ['reports-overview', filters],
    queryFn: () => api<ReportsApiResponse>(`/reports${reportQueryString}`),
    staleTime: 30000
  });

  const handleFilterChange = (updated: Partial<ReportFilterState>) => {
    setFilters((prev) => {
      let newFrom = prev.from;
      let newTo = prev.to;

      if (updated.preset && updated.preset !== 'custom') {
        const computed = computePresetDates(updated.preset);
        newFrom = computed.from;
        newTo = computed.to;
      } else if (updated.from || updated.to) {
        newFrom = updated.from || prev.from;
        newTo = updated.to || prev.to;
      }

      return {
        ...prev,
        ...updated,
        from: newFrom,
        to: newTo
      };
    });
  };

  const handleClearFilters = () => {
    const computed = computePresetDates('this-month');
    setFilters({
      preset: 'this-month',
      from: computed.from,
      to: computed.to,
      reportGroup: 'All spending',
      categoryId: undefined,
      payeeId: undefined,
      needsReview: undefined
    });
  };

  const handleRefresh = () => {
    refetchReport();
  };

  const activeCategory = masterData?.categories.find((c) => c.id === filters.categoryId);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 space-y-4 pb-12">
      {/* Global Filter Bar (No header block, sits right below nav) */}
      <ReportFilters
        filters={filters}
        categories={masterData?.categories || []}
        payees={masterData?.payees || []}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {/* Connection / Backend Error Alert */}
      {reportError && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>Unable to load report data from the backend server. Make sure port 4782 is accessible.</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 font-bold text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {reportLoading ? (
        <ReportSkeletons />
      ) : reportData ? (
        <>
          {/* KPI Row (4 Compact Cards) */}
          <KpiGrid
            totals={reportData.totals}
            activeCategoryName={activeCategory?.name}
            onReviewClick={() => handleFilterChange({ needsReview: true })}
          />

          {/* 2-Column Stack Layout (Removes row-based height waiting & blank gaps) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column Stack (Cash Outflow Trend + Spend by Category) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <CashOutflowTrend
                data={reportData.daily}
                from={filters.from}
                to={filters.to}
              />
              <CategorySpendChart
                categories={reportData.categories}
                totalOutflowPaise={reportData.totals.totalPaise}
                activeCategoryId={filters.categoryId}
                onCategorySelect={(catId) => handleFilterChange({ categoryId: catId })}
              />
            </div>

            {/* Right Column Stack (Outflow Type Breakdown + Top Payees) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <OutflowTypeCard
                groups={reportData.outflowGroups || []}
                totalPaise={reportData.totals.totalPaise}
              />
              <TopPayeesCard
                payees={reportData.payees}
                totalOutflowPaise={reportData.totals.totalPaise}
                activePayeeId={filters.payeeId}
                onPayeeSelect={(pId) => handleFilterChange({ payeeId: pId })}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
