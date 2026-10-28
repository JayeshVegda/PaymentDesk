import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Bot, CalendarClock, Forward, Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, patch, type SystemStatus } from '../api/client';
import { StatusBanner } from '../components/common/StatusBanner';

interface NotificationSettings {
  forwardEnabled: boolean;
  summariesEnabled: boolean;
}

interface ToggleRowProps {
  icon: typeof Forward;
  title: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
}

function ToggleRow({ icon: Icon, title, description, enabled, busy, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F4FF]">
          <Icon size={16} className="text-[#165DFF]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#667085]">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        disabled={busy}
        onClick={() => onToggle(!enabled)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165DFF] disabled:cursor-progress ${
          enabled ? 'bg-[#165DFF]' : 'bg-[#DDE3EC]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
            enabled ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isError: settingsError } = useQuery<NotificationSettings>({
    queryKey: ['settings'],
    queryFn: () => api<NotificationSettings>('/settings')
  });
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: () => api('/system/status')
  });

  const mutation = useMutation({
    mutationFn: (input: Partial<NotificationSettings>) => patch<NotificationSettings>('/settings', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previous = queryClient.getQueryData<NotificationSettings>(['settings']);
      if (previous) queryClient.setQueryData(['settings'], { ...previous, ...input });
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['settings'], context.previous);
      toast.error(error instanceof Error ? error.message : 'Setting could not be saved');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['system-status'] });
    }
  });

  const telegram = status?.telegram;
  const telegramState = !telegram?.enabled
    ? 'disabled'
    : !telegram.configured
      ? 'incomplete'
      : 'active';

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Settings</h1>

      {telegramState === 'disabled' ? (
        <StatusBanner
          tone="amber"
          title="Telegram companion is disabled"
          description="Set TELEGRAM_ENABLED=true (plus bot token and allowed IDs) in C:\\PaymentDesk\\.env and restart the PaymentDesk service to use these switches."
        />
      ) : telegramState === 'incomplete' ? (
        <StatusBanner
          tone="amber"
          title="Telegram is missing its token or allowlist"
          description="Add TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_ID and TELEGRAM_ALLOWED_CHAT_ID in the .env file, then restart the service."
        />
      ) : null}

      <section className="ledger-card overflow-hidden" aria-labelledby="telegram-heading">
        <div className="flex items-center justify-between border-b border-[#EEF1F6] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot size={17} className="text-[#165DFF]" />
            <h2 id="telegram-heading" className="text-sm font-bold text-[#111827]">Telegram</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              telegramState === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F6F8FC] text-[#667085]'
            }`}
          >
            {telegramState === 'active' ? 'Bot active' : telegramState === 'incomplete' ? 'Not configured' : 'Disabled'}
          </span>
        </div>
        {settingsError || !settings ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm text-[#667085]">
            <Loader2 size={15} className="animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            <ToggleRow
              icon={settings.forwardEnabled ? Forward : BellOff}
              title="Forward new payments"
              description="Every new payment (except silent ones) is sent to your allowed chats. Pausing keeps a backlog: when you switch it back on, the payments recorded while paused are delivered."
              enabled={settings.forwardEnabled}
              busy={mutation.isPending}
              onToggle={(next) => mutation.mutate({ forwardEnabled: next })}
            />
            <ToggleRow
              icon={settings.summariesEnabled ? CalendarClock : Bell}
              title="Scheduled summaries"
              description={`Automatic 6 PM and 8 PM day summaries${telegram?.summaryTimes ? ` (${telegram.summaryTimes})` : ''}. The bot itself stays interactive either way.`}
              enabled={settings.summariesEnabled}
              busy={mutation.isPending}
              onToggle={(next) => mutation.mutate({ summariesEnabled: next })}
            />
          </>
        )}
      </section>

      <section className="ledger-card overflow-hidden" aria-labelledby="backup-heading">
        <div className="flex items-center justify-between border-b border-[#EEF1F6] px-4 py-3">
          <div className="flex items-center gap-2">
            <Save size={17} className="text-[#165DFF]" />
            <h2 id="backup-heading" className="text-sm font-bold text-[#111827]">Backups</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            {status ? `${status.backupCount} on disk` : '…'}
          </span>
        </div>
        <p className="px-4 py-3.5 text-xs leading-relaxed text-[#667085]">
          {status?.lastBackup
            ? `Last verified backup: ${status.lastBackup.name}. Backups run daily from the unified task and copy to H:\\Web_Data\\paymentdesk\\. To create one now, open System and use Create backup.`
            : 'Daily backups run from the unified task; status appears once the System page has loaded once.'}
        </p>
      </section>

      <section className="ledger-card overflow-hidden" aria-labelledby="system-heading">
        <div className="flex items-center gap-2 border-b border-[#EEF1F6] px-4 py-3">
          <SettingsIcon size={17} className="text-[#165DFF]" />
          <h2 id="system-heading" className="text-sm font-bold text-[#111827]">System</h2>
        </div>
        <p className="px-4 py-3.5 text-xs leading-relaxed text-[#667085]">
          {status
            ? `Database ${status.journalMode.toUpperCase()} · integrity ${status.integrity} · ${status.payeeCount} active payees. Full health, database path and backups live on the System page.`
            : 'Loading…'}
        </p>
      </section>
    </div>
  );
}
