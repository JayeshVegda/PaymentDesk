import React from 'react';

const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#0284C7', // Sky
  '#4F46E5', // Indigo
  '#0D9488', // Teal
];

function getHashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index]!;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface PayeeAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export const PayeeAvatar: React.FC<PayeeAvatarProps> = ({ name, size = 32, className = '' }) => {
  const initials = getInitials(name);
  const bgColor = getHashColor(name);

  return (
    <div
      className={`payee-avatar flex-shrink-0 font-bold select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: bgColor,
        fontSize: `${Math.round(size * 0.4)}px`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
};
