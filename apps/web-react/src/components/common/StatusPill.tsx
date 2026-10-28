import React from 'react';

export type StatusPillVariant = 'amber' | 'green' | 'blue' | 'gray';

interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ variant, label, icon, className = '' }) => {
  const variantClasses = {
    amber: 'status-pill-amber',
    green: 'status-pill-green',
    blue: 'status-pill-blue',
    gray: 'status-pill-gray',
  }[variant];

  return (
    <span className={`status-pill ${variantClasses} ${className}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
};
