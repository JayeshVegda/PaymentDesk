import React from 'react';
import { formatCompactINR, formatInrFull } from '../../lib/format-inr';

export interface PayeeRow {
  id: number;
  label: string;
  type: string;
  totalPaise: number;
  paymentCount: number;
}

interface TopPayeesCardProps {
  payees: PayeeRow[];
  totalOutflowPaise: number;
  activePayeeId?: number | undefined;
  onPayeeSelect: (payeeId?: number | undefined) => void;
}

export function TopPayeesCard({
  payees,
  totalOutflowPaise,
  activePayeeId,
  onPayeeSelect
}: TopPayeesCardProps) {
  const top5 = payees.slice(0, 5);
  const maxPaise = top5[0]?.totalPaise || 1;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Top Payees
          </h3>
          <span className="text-xs text-slate-400">Click payee to filter</span>
        </div>
        <p className="text-xs text-slate-500">Highest individual payment recipients</p>
      </div>

      {top5.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          {top5.map((payee, idx) => {
            const pct =
              totalOutflowPaise > 0
                ? Number(((payee.totalPaise / totalOutflowPaise) * 100).toFixed(1))
                : 0;
            const barWidth = Math.round((payee.totalPaise / maxPaise) * 100);
            const isSelected = activePayeeId === payee.id;

            return (
              <div
                key={payee.id}
                onClick={() => onPayeeSelect(isSelected ? undefined : payee.id)}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-slate-400 font-bold text-[11px] w-4">{idx + 1}</span>
                    <span className="text-slate-800 font-bold truncate">{payee.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-bold text-slate-900" title={formatInrFull(payee.totalPaise)}>
                      {formatCompactINR(payee.totalPaise)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal w-10 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-800 h-full rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 italic">
          No payees match this selection.
        </div>
      )}
    </div>
  );
}
