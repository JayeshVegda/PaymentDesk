import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, post } from '../api/client';
import { AlertTriangle, Bot, CheckCircle2, Database, DownloadCloud, HardDrive, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBanner } from '../components/common/StatusBanner';

interface Status {
  databasePath: string;
  databaseSizeBytes: number;
  integrity: string;
  journalMode: string;
  foreignKeys: boolean;
  backupCount: number;
  lastBackup: { name: string; sizeBytes: number; modifiedAt: string } | null;
  backupsSizeBytes: number;
  counts: { total: number; posted: number; voided: number; review: number };
  payeeCount: number;
  lastActivity: string | null;
  telegram: {
    enabled: boolean;
    configured: boolean;
    status: 'active' | 'incomplete' | 'disabled';
    summaryTimes: string;
    lastForwardedTransactionId: number;
    lastSummary6Date: string | null;
    lastSummary8Date: string | null;
    panelVersion: string | null;
  };
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function SystemPage() {
  const [backingUp, setBackingUp] = useState(false);
  const { data: status, isError, refetch } = useQuery<Status>({
    queryKey: ['system-status'],
    queryFn: () => api<Status>('/system/status')
  });

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const result = await post<{ filename: string }>('/system/backup', {});
      toast.success('Backup created and verified', { description: result.filename });
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  if (isError) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">System status is unavailable.</div>;
  if (!status) return <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div>;

  const healthy = status.integrity === 'ok' && status.foreignKeys && status.journalMode.toLowerCase() === 'wal';
  const reviewRate = status.counts.posted ? (status.counts.review / status.counts.posted) * 100 : 0;
  const lastBackupAge = status.lastBackup ? Math.floor((Date.now() - new Date(status.lastBackup.modifiedAt).getTime()) / 86400000) : null;

  return (
    <div className="space-y-3">
      <h1 className="sr-only">System</h1>
      {status.integrity !== 'ok' || !status.foreignKeys ? (
        <StatusBanner
          tone="red"
          title="Database needs immediate attention"
          description={`Integrity: ${status.integrity} · Foreign keys ${status.foreignKeys ? 'enabled' : 'disabled'}. Stop data entry and run a backup now.`}
        />
      ) : lastBackupAge === null || lastBackupAge > 7 ? (
        <StatusBanner
          tone="amber"
          title="Backup overdue"
          description={lastBackupAge === null ? 'No backup has been created yet.' : `Last backup was ${lastBackupAge} days ago. Create a fresh verified backup.`}
        />
      ) : (
        <StatusBanner
          tone="green"
          title="Database healthy"
          description={`WAL journal active · integrity ok · last backup ${lastBackupAge === 0 ? 'today' : `${lastBackupAge}d ago`}`}
        />
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="ledger-card p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#667085]">Database</span><Database size={17} className="text-[#165DFF]" /></div>
          <strong className="mt-3 block text-xl text-[#111827]">{healthy ? 'Healthy' : 'Attention needed'}</strong>
          <p className="mt-1 text-xs text-[#667085]">{status.journalMode.toUpperCase()} · integrity {status.integrity}</p>
        </article>
        <article className="ledger-card p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#667085]">Transactions</span><CheckCircle2 size={17} className="text-[#165DFF]" /></div>
          <strong className="mt-3 block text-xl tabular-nums text-[#111827]">{status.counts.total.toLocaleString('en-IN')}</strong>
          <p className="mt-1 text-xs text-[#667085]">{status.counts.posted} posted · {status.counts.voided} voided</p>
        </article>
        <article className="ledger-card p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#667085]">Payees</span><Users size={17} className="text-[#165DFF]" /></div>
          <strong className="mt-3 block text-xl tabular-nums text-[#111827]">{status.payeeCount.toLocaleString('en-IN')}</strong>
          <p className="mt-1 text-xs text-[#667085]">{status.counts.review} review items · {reviewRate.toFixed(1)}%</p>
        </article>
        <article className="ledger-card p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#667085]">Storage</span><HardDrive size={17} className="text-[#165DFF]" /></div>
          <strong className="mt-3 block text-xl tabular-nums text-[#111827]">{formatSize(status.databaseSizeBytes)}</strong>
          <p className="mt-1 truncate text-xs text-[#667085]" title={status.databasePath}>{status.databasePath}</p>
        </article>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <article className="ledger-card p-4 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className={healthy ? 'text-emerald-600' : 'text-amber-600'} /><h2 className="font-bold text-[#111827]">Data health</h2></div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{healthy ? 'All checks passed' : 'Check configuration'}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-4">
            <Health label="Integrity" value={status.integrity === 'ok' ? 'OK' : status.integrity} good={status.integrity === 'ok'} />
            <Health label="Foreign keys" value={status.foreignKeys ? 'Enabled' : 'Disabled'} good={status.foreignKeys} />
            <Health label="Journal mode" value={status.journalMode.toUpperCase()} good={status.journalMode.toLowerCase() === 'wal'} />
            <Health label="Needs review" value={String(status.counts.review)} good={status.counts.review === 0} />
            <Health label="Last activity" value={status.lastActivity ? new Date(status.lastActivity).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'None'} good />
            <Health label="Backups" value={`${status.backupCount} files`} good={status.backupCount > 0} />
            <Health label="Backup storage" value={formatSize(status.backupsSizeBytes)} good />
            <Health label="Last backup" value={lastBackupAge === null ? 'Never' : lastBackupAge === 0 ? 'Today' : `${lastBackupAge}d ago`} good={lastBackupAge !== null && lastBackupAge <= 7} />
          </div>
        </article>

        <article className="ledger-card flex flex-col p-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><DownloadCloud size={18} className="text-[#165DFF]" /><h2 className="font-bold">Backups</h2></div><span className="text-xs text-[#667085]">{status.backupCount} saved</span></div>
          <div className="my-4 rounded-xl border border-[#DDE3EC] bg-[#F8FAFD] p-3 text-xs text-[#667085]">
            <strong className="mb-1 block truncate text-sm text-[#344054]">{status.lastBackup?.name || 'No backup yet'}</strong>
            {status.lastBackup ? `${formatSize(status.lastBackup.sizeBytes)} · ${new Date(status.lastBackup.modifiedAt).toLocaleString('en-IN')}` : 'Create the first verified SQLite backup.'}
          </div>
          <button onClick={handleBackup} disabled={backingUp} className="btn btn-primary mt-auto h-10 w-full gap-2"><DownloadCloud size={15} className={backingUp ? 'animate-spin' : ''} />{backingUp ? 'Creating backup…' : 'Back up now'}</button>
        </article>
      </div>

      <article className="ledger-card p-4">
        <div className="grid items-center gap-4 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F1FF] text-[#165DFF]"><Bot size={20} /></span><div><h2 className="font-bold">Telegram</h2><p className="text-xs text-[#667085]">Private bot delivery and summaries</p></div></div>
          <Health label="Connection" value={status.telegram.status === 'active' ? 'Active' : status.telegram.status === 'incomplete' ? 'Setup incomplete' : 'Disabled'} good={status.telegram.status === 'active'} />
          <Health label="Daily summaries" value={status.telegram.summaryTimes.split(',').join(' · ')} good={status.telegram.enabled} />
          <Health label="Last forwarded ID" value={status.telegram.lastForwardedTransactionId ? `#${status.telegram.lastForwardedTransactionId}` : 'None'} good={status.telegram.lastForwardedTransactionId > 0} />
          <Health label="Latest summaries" value={[status.telegram.lastSummary6Date, status.telegram.lastSummary8Date].filter(Boolean).join(' · ') || 'Pending'} good={Boolean(status.telegram.lastSummary6Date || status.telegram.lastSummary8Date)} />
        </div>
      </article>
    </div>
  );
}

function Health({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#98A2B3]">{label}</span><span className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[#344054]">{good ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={13} className="shrink-0 text-amber-600" />}{value}</span></div>;
}
