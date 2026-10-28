import React from 'react';

export function ReportSkeletons() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* KPI Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="h-3 bg-slate-200 rounded-md w-24" />
            <div className="h-8 bg-slate-200 rounded-md w-36" />
            <div className="h-3 bg-slate-100 rounded-md w-20" />
          </div>
        ))}
      </div>

      {/* 2-Column Stack Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column Stack */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 h-[280px]" />
          <div className="bg-white p-5 rounded-xl border border-slate-200 h-[280px]" />
        </div>

        {/* Right Column Stack */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 h-[240px]" />
          <div className="bg-white p-5 rounded-xl border border-slate-200 h-[280px]" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 h-[260px]" />
    </div>
  );
}
