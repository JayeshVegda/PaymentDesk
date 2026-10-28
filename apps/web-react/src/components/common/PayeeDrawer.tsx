import React from 'react';
import { Payee, formatInr } from '../../api/client';
import { PayeeAvatar } from './PayeeAvatar';
import { X, Star, Hash, FileText, UserCheck, Building2, User } from 'lucide-react';

interface PayeeDrawerProps {
  payee: Payee | null;
  onClose: () => void;
}

export const PayeeDrawer: React.FC<PayeeDrawerProps> = ({ payee, onClose }) => {
  if (!payee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-200"
        style={{ boxShadow: 'var(--shadow-drawer)' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#DDE3EC] flex items-center justify-between bg-[#F6F8FC]">
          <div className="flex items-center gap-3">
            <PayeeAvatar name={payee.name} size={44} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#111827]">{payee.name}</h2>
                {payee.favourite && <Star size={16} className="text-amber-500 fill-amber-500" />}
              </div>
              <span className="text-xs text-[#667085] capitalize flex items-center gap-1 mt-0.5">
                {payee.type === 'company' ? <Building2 size={12} /> : <User size={12} />}
                {payee.type} Payee
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#667085] hover:text-[#111827] hover:bg-[#E9F1FF] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Total Outgoing Paid */}
          <div className="p-6 rounded-xl bg-[#F6F8FC] border border-[#DDE3EC] text-center">
            <span className="text-xs font-semibold text-[#667085] block uppercase tracking-wider">TOTAL SPENT TO DATE</span>
            <span className="text-3xl font-extrabold tabular-nums text-[#111827] block mt-1">
              {formatInr(payee.totalPaidPaise)}
            </span>
            <span className="mt-2 inline-block text-xs font-semibold text-[#667085]">
              Across {payee.paymentCount} total transactions
            </span>
          </div>

          {/* Payee Info Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                <Hash size={18} className="text-[#165DFF]" />
                <div>
                  <span className="text-xs font-medium text-[#667085]">Total Payments</span>
                  <p className="text-sm font-semibold text-[#111827]">{payee.paymentCount}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-[#DDE3EC] flex items-center gap-2.5">
                <UserCheck size={18} className="text-[#165DFF]" />
                <div>
                  <span className="text-xs font-medium text-[#667085]">Status</span>
                  <p className="text-sm font-semibold text-[#111827]">
                    {payee.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>

            {payee.aliases && payee.aliases.length > 0 && (
              <div className="p-3 rounded-lg border border-[#DDE3EC]">
                <span className="text-xs font-medium text-[#667085] block mb-1.5">Known Aliases</span>
                <div className="flex flex-wrap gap-1.5">
                  {payee.aliases.map((alias, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-md font-mono">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {payee.notes && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} /> Notes
                </span>
                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{payee.notes}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-[#667085]">
              <span>Created: {new Date(payee.createdAt).toLocaleDateString('en-IN')}</span>
              <span>Updated: {new Date(payee.updatedAt).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
