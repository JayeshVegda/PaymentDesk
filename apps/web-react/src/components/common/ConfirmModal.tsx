import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, HelpCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  previewData?: Record<string, React.ReactNode> | undefined;
  onConfirm: (typedPhrase?: string) => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  /** When set, an input appears and confirmation is blocked until it matches exactly. */
  phraseToConfirm?: string | undefined;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  previewData,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  phraseToConfirm
}) => {
  const [confirming, setConfirming] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const phraseSatisfied =
    !phraseToConfirm ||
    typedPhrase.trim() === phraseToConfirm.trim();

  useEffect(() => {
    if (!isOpen) {
      setTypedPhrase('');
      setConfirming(false);
    }
  }, [isOpen]);

  const confirm = async () => {
    if (confirming || !phraseSatisfied) return;
    setConfirming(true);
    try {
      await onConfirm(phraseToConfirm ? typedPhrase : undefined);
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
      } else if (
        event.key === 'Enter' &&
        dialogRef.current?.contains(event.target as Node)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void confirm();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, confirming, onConfirm, onCancel, phraseSatisfied]);

  if (!isOpen) return null;

  const colorMap = {
    danger: {
      icon: <AlertTriangle className="text-rose-600" size={24} />,
      bg: 'bg-rose-50 border-rose-200',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white'
    },
    warning: {
      icon: <AlertTriangle className="text-amber-600" size={24} />,
      bg: 'bg-amber-50 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    success: {
      icon: <CheckCircle className="text-emerald-600" size={24} />,
      bg: 'bg-emerald-50 border-emerald-200',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    },
    info: {
      icon: <HelpCircle className="text-blue-600" size={24} />,
      bg: 'bg-blue-50 border-blue-200',
      btn: 'bg-[#165DFF] hover:bg-[#165DFF]/90 text-white'
    }
  };

  const colors = colorMap[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onCancel}
      />

      {/* Modal Content */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative bg-white rounded-2xl max-w-lg w-full shadow-xl border border-[#DDE3EC] overflow-hidden transform transition-all p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl border ${colors.bg}`}>
            {colors.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-lg font-bold text-[#111827] truncate">{title}</h3>
            <p className="text-xs text-[#667085] mt-1">{description}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview Panel */}
        {previewData && Object.keys(previewData).length > 0 && (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#667085] border-b border-slate-200 pb-2 mb-2">
              Payment preview
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {Object.entries(previewData).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start gap-4">
                  <span className="text-[#667085] font-medium shrink-0">{key}</span>
                  <span className={`text-[#111827] text-right break-all ${key === 'Amount' ? 'text-xl font-black tabular-nums' : 'font-semibold'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Typed confirmation phrase */}
        {phraseToConfirm && (
          <div className="space-y-1.5">
            <label htmlFor="confirm-modal-phrase" className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
              Type <span className="font-mono text-rose-600 normal-case">{phraseToConfirm}</span> to enable deletion
            </label>
            <input
              id="confirm-modal-phrase"
              type="text"
              value={typedPhrase}
              onChange={(event) => setTypedPhrase(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={`form-input text-sm ${typedPhrase && !phraseSatisfied ? 'border-rose-400 focus:border-rose-500' : ''}`}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary h-9 px-4 text-xs font-bold text-slate-700"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={confirming || !phraseSatisfied}
            title={!phraseSatisfied ? `Type "${phraseToConfirm}" first` : undefined}
            className={`btn h-9 px-4 text-xs font-bold ${colors.btn} ${!phraseSatisfied ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {confirming ? 'Saving…' : confirmText}
          </button>
        </div>
        <p className="text-right text-[11px] font-medium text-[#98A2B3]">Enter to record · Esc to cancel</p>
      </div>
    </div>
  );
};
