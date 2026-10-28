import React from 'react';

interface StatusBannerProps {
  tone: 'green' | 'amber' | 'red';
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const TONES = {
  green: {
    container: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    title: 'text-emerald-800',
    description: 'text-emerald-700'
  },
  amber: {
    container: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500',
    title: 'text-amber-800',
    description: 'text-amber-700'
  },
  red: {
    container: 'border-rose-200 bg-rose-50',
    dot: 'bg-rose-500',
    title: 'text-rose-800',
    description: 'text-rose-700'
  }
} as const;

export const StatusBanner: React.FC<StatusBannerProps> = ({ tone, title, description, action }) => {
  const colors = TONES[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colors.container}`} role="status">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${colors.title}`}>{title}</p>
        {description && <p className={`mt-0.5 text-xs font-medium ${colors.description}`}>{description}</p>}
      </div>
      {action}
    </div>
  );
};
