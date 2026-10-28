import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { formatCompactINR, formatInrFull } from '../../lib/format-inr';

export interface TrendPoint {
  label: string;
  totalPaise: number;
  paymentCount: number;
  cashPaise?: number;
  nonCashPaise?: number;
  businessOperatingPaise?: number;
}

interface CashOutflowTrendProps {
  data: TrendPoint[];
  from: string;
  to: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TrendPoint }>;
  label?: string | number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const pointData = payload[0]?.payload as TrendPoint;

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-lg text-xs space-y-1.5 z-50">
      <p className="font-bold text-slate-800 border-b border-slate-100 pb-1">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500 font-medium">Total Outflow:</span>
        <strong className="text-slate-900 tabular-nums">{formatInrFull(pointData.totalPaise)}</strong>
      </div>
      {pointData.businessOperatingPaise !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 font-medium">Business Spend:</span>
          <strong className="text-blue-600 tabular-nums">{formatInrFull(pointData.businessOperatingPaise)}</strong>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500 font-medium">Payments:</span>
        <span className="text-slate-700 font-semibold">{pointData.paymentCount}</span>
      </div>
    </div>
  );
}

export function CashOutflowTrend({ data, from, to }: CashOutflowTrendProps) {
  const useLineChart = data.length >= 8;

  const formattedData = data.map((item) => ({
    ...item,
    displayLabel: item.label.length >= 10 ? item.label.slice(5) : item.label,
    totalRupees: item.totalPaise / 100,
    operatingRupees: (item.businessOperatingPaise ?? 0) / 100
  }));

  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Cash Outflow Over Time
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {from} to {to}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {useLineChart ? 'Daily cash trend overview' : 'Sparse period totals (Bar representation)'}
        </p>
      </div>

      {formattedData.length > 0 ? (
        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            {useLineChart ? (
              <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  tickFormatter={(val) => formatCompactINR(val * 100)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="totalRupees"
                  name="Total Outflow"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#EF4444' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="operatingRupees"
                  name="Business Spend"
                  stroke="#2563EB"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            ) : (
              <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  tickFormatter={(val) => formatCompactINR(val * 100)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalRupees" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 italic">
          No outflow data available for selected period.
        </div>
      )}
    </div>
  );
}
