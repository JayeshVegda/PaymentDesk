import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { formatCompactINR, formatInrFull } from '../../lib/format-inr';

export interface CategoryRow {
  categoryId?: number | undefined;
  label: string;
  totalPaise: number;
  paymentCount: number;
  averageTransactionPaise?: number | undefined;
}

interface CategorySpendChartProps {
  categories: CategoryRow[];
  totalOutflowPaise: number;
  activeCategoryId?: number | undefined;
  onCategorySelect: (categoryId?: number | undefined) => void;
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: CategoryRow }>;
  totalOutflowPaise?: number;
}

function CategoryTooltip({ active, payload, totalOutflowPaise }: CategoryTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload as CategoryRow | undefined;
  if (!item) return null;
  const outflow = totalOutflowPaise ?? 0;
  const pct = outflow > 0 ? ((item.totalPaise / outflow) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-lg text-xs space-y-1 z-50">
      <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{item.label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500 font-medium">Total Spend:</span>
        <strong className="text-slate-900 tabular-nums">{formatInrFull(item.totalPaise)}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500 font-medium">Payments:</span>
        <span className="text-slate-700 font-semibold">{item.paymentCount}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500 font-medium">Share of Outflow:</span>
        <span className="text-blue-600 font-bold">{pct}%</span>
      </div>
      {item.averageTransactionPaise !== undefined && (
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100">
          <span className="text-slate-500">Average:</span>
          <span className="text-slate-700">{formatInrFull(item.averageTransactionPaise)}</span>
        </div>
      )}
    </div>
  );
}

export function CategorySpendChart({
  categories,
  totalOutflowPaise,
  activeCategoryId,
  onCategorySelect
}: CategorySpendChartProps) {
  const topCategories = categories.slice(0, 6).map((c) => ({
    ...c,
    totalRupees: c.totalPaise / 100
  }));

  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Spend by Category
          </h3>
          <span className="text-xs text-slate-400">Click bar to filter</span>
        </div>
        <p className="text-xs text-slate-500">Top expense categories sorted by total outflow</p>
      </div>

      {topCategories.length > 0 ? (
        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={topCategories}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="#94A3B8"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickFormatter={(val) => formatCompactINR(val * 100)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                stroke="#94A3B8"
                tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                width={110}
                tickLine={false}
              />
              <Tooltip content={<CategoryTooltip totalOutflowPaise={totalOutflowPaise} />} />
              <Bar
                dataKey="totalRupees"
                radius={[0, 4, 4, 0]}
                barSize={18}
                onClick={(mouseEvent) => {
                  const payload = (
                    mouseEvent as unknown as { payload?: { categoryId?: number } } | null
                  )?.payload;
                  const clickedId = payload?.categoryId;
                  if (clickedId != null) {
                    onCategorySelect(activeCategoryId === clickedId ? undefined : clickedId);
                  }
                }}
                className="cursor-pointer"
              >
                {topCategories.map((entry) => (
                  <Cell
                    key={entry.categoryId ?? entry.label}
                    fill={activeCategoryId === entry.categoryId ? '#2563EB' : '#3B82F6'}
                    opacity={activeCategoryId && activeCategoryId !== entry.categoryId ? 0.4 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 italic">
          No category spending for this period.
        </div>
      )}
    </div>
  );
}
