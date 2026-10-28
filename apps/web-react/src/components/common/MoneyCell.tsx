import React from 'react';
import { formatInr } from '../../api/client';

interface MoneyCellProps {
  amountPaise: number;
  weight?: 'normal' | 'semibold' | 'bold';
  size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  type?: 'outgoing' | 'incoming' | 'neutral';
  className?: string;
}

export const MoneyCell: React.FC<MoneyCellProps> = ({
  amountPaise,
  weight = 'bold',
  size = 'base',
  type = 'outgoing',
  className = '',
}) => {
  const formatted = formatInr(amountPaise);

  const weightClasses = {
    normal: 'font-normal',
    semibold: 'font-semibold',
    bold: 'font-bold',
  }[weight];

  const sizeClasses = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  }[size];

  const typeClasses = {
    outgoing: 'text-slate-900',
    incoming: 'text-emerald-600',
    neutral: 'text-slate-700',
  }[type];

  return (
    <span className={`tabular-nums text-right ${weightClasses} ${sizeClasses} ${typeClasses} ${className}`}>
      {formatted}
    </span>
  );
};
