import React from 'react';
import { formatInr } from '../../api/client';

interface HeroStatCardProps {
  title: string;
  amountPaise: number;
  subtitle?: string;
  accentColor?: 'red' | 'green' | 'amber' | 'blue';
  isHero?: boolean;
  className?: string;
}

export const HeroStatCard: React.FC<HeroStatCardProps> = ({
  title,
  amountPaise,
  subtitle,
  accentColor = 'red',
  isHero = false,
  className = '',
}) => {
  const borderTopStyle = {
    red: 'border-t-2 border-t-[#FF2638]',
    green: 'border-t-2 border-t-[#00B96B]',
    amber: 'border-t-2 border-t-[#F79009]',
    blue: 'border-t-2 border-t-[#165DFF]',
  }[accentColor];

  return (
    <div
      className={`ledger-card ${borderTopStyle} flex flex-col justify-between transition-all ${
        isHero ? 'md:col-span-2' : ''
      } ${className}`}
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">
          {title}
        </span>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`tabular-nums font-bold text-[#111827] ${
              isHero ? 'text-3xl md:text-4xl' : 'text-2xl'
            }`}
          >
            {formatInr(amountPaise)}
          </span>
        </div>
      </div>
      {subtitle && (
        <p className="mt-3 text-xs font-medium text-[#667085]">{subtitle}</p>
      )}
    </div>
  );
};
