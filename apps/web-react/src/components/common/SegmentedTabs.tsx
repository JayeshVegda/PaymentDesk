import React from 'react';

export interface TabOption {
  id: string;
  label: string;
  count?: number;
  badgeColor?: string;
}

interface SegmentedTabsProps {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  options,
  activeId,
  onChange,
  className = '',
}) => {
  return (
    <div className={`segmented-control ${className}`}>
      {options.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`segmented-tab flex items-center gap-1.5 ${isActive ? 'active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                  isActive
                    ? 'bg-[#165DFF] text-white'
                    : tab.badgeColor || 'bg-[#F79009] text-white'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
