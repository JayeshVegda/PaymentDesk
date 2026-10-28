import React from 'react';
import { formatCompactINR, formatInrFull } from '../../lib/format-inr';
import { GROUP_COLOR_MAP } from '../../lib/report-groups';

export interface OutflowGroupItem {
  groupName: string;
  amountPaise: number;
  transactionCount: number;
  percentage: number;
}

interface OutflowTypeCardProps {
  groups: OutflowGroupItem[];
  totalPaise: number;
}

export function OutflowTypeCard({ groups, totalPaise }: OutflowTypeCardProps) {
  const allStandardGroups = [
    'Business Operating',
    'Business Capital',
    'Investment / Asset Transfer',
    'Advance / Unsettled',
    'Personal / House'
  ];

  // Merge returned group items with defaults
  const groupMap = new Map(groups.map((g) => [g.groupName, g]));
  const rows = allStandardGroups.map((name) => {
    const item = groupMap.get(name);
    const amount = item?.amountPaise || 0;
    const count = item?.transactionCount || 0;
    const pct = totalPaise > 0 ? Number(((amount / totalPaise) * 100).toFixed(1)) : 0;
    return {
      groupName: name,
      amountPaise: amount,
      transactionCount: count,
      percentage: pct,
      color: GROUP_COLOR_MAP[name] || '#86909C'
    };
  });

  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Outflow Type Breakdown
        </h3>
        <p className="text-xs text-slate-500">Distribution across accounting classifications</p>
      </div>

      <div className="space-y-2.5 pt-1">
        {rows.map((row) => (
          <div key={row.groupName} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-800 font-bold">{row.groupName}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-bold text-slate-900" title={formatInrFull(row.amountPaise)}>
                  {formatCompactINR(row.amountPaise)}
                </span>
                <span className="text-[11px] text-slate-400 font-normal w-10 text-right">
                  {row.percentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(row.percentage, 100)}%`,
                  backgroundColor: row.color
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
