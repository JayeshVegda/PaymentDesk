import { autoRetry } from '@grammyjs/auto-retry';
import { LedgerService, businessNow, type DatabaseRuntime } from '@payment-ledger/database';
import { Bot, InlineKeyboard, Keyboard, type Context } from 'grammy';

type Mode = 'idle' | 'record' | 'find';

interface TelegramCompanion {
  stop(): Promise<void>;
}

function money(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(paise / 100);
}

function time12(value: string): string {
  const [hourText = '0', minute = '00'] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const panelLabels = {
  record: '💸 Record payment',
  today: '📊 Today',
  recent: '🧾 Recent payments',
  review: '⚠️ Needs review',
  find: '🔎 Find payee',
  main: '🏠 Main panel'
} as const;

function mainKeyboard(): Keyboard {
  return new Keyboard()
    .text(panelLabels.record).text(panelLabels.today).row()
    .text(panelLabels.recent).text(panelLabels.review).row()
    .text(panelLabels.find).text(panelLabels.main)
    .resized()
    .persistent();
}

function previewKeyboard(categories: Array<{ id: number; name: string }> = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  categories.slice(0, 6).forEach((category, index) => {
    keyboard.text(`🏷 ${category.name}`, `payment:category:${category.id}`);
    if (index % 2 === 1) keyboard.row();
  });
  if (categories.length % 2 === 1) keyboard.row();
  return keyboard
    .text('✅ Record payment', 'payment:record').row()
    .text('✏️ Edit', 'payment:edit')
    .text('✖️ Cancel', 'payment:cancel');
}

function getSetting(runtime: DatabaseRuntime, key: string): string | null {
  const row = runtime.sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  const value = JSON.parse(row.value) as unknown;
  return typeof value === 'string' ? value : String(value);
}

function setSetting(runtime: DatabaseRuntime, key: string, value: string): void {
  runtime.sqlite
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, JSON.stringify(value));
}

export function startTelegramCompanion(runtime: DatabaseRuntime): TelegramCompanion | null {
  if (process.env.TELEGRAM_ENABLED !== 'true') return null;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const allowedUserIds = (process.env.TELEGRAM_ALLOWED_USER_ID || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const allowedChatIds = (process.env.TELEGRAM_ALLOWED_CHAT_ID || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isSafeInteger(id));

  if (!token || allowedUserIds.length === 0 || allowedChatIds.length === 0) {
    throw new Error('Telegram is enabled but its token or allowlist IDs are invalid');
  }

  const ledger = new LedgerService(runtime);
  const bot = new Bot(token);
  bot.api.config.use(autoRetry({ maxRetryAttempts: 4, maxDelaySeconds: 30 }));
  const mode = new Map<number, Mode>();
  const pendingCommand = new Map<number, string>();
  const deliveredTransactionIds = new Set<number>();
  let stopped = false;
  let forwarding = false;
  let forwardPauseLogged = false;
  let summaryPauseLogged = false;

  const authorised = (ctx: Context): boolean =>
    Boolean(
      ctx.from?.id &&
        allowedUserIds.includes(ctx.from.id) &&
        ctx.chat?.id &&
        allowedChatIds.includes(ctx.chat.id) &&
        ctx.chat.type === 'private'
    );

  bot.use(async (ctx, next) => {
    if (!authorised(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Not authorised' }).catch(() => undefined);
      return;
    }
    await next();
  });

  const sendPanel = async (ctx: Context, text = '🏠 <b>Payment Ledger</b>\nChoose what you want to do.') => {
    if (ctx.chat?.id) mode.set(ctx.chat.id, 'idle');
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainKeyboard() });
  };

  const paymentPreviewText = (preview: ReturnType<LedgerService['previewQuickEntry']>) => [
    '🧾 <b>Confirm payment</b>',
    '',
    `💰 <b>${money(preview.amountPaise ?? 0)}</b>`,
    `👤 ${escapeHtml(preview.payeeName ?? 'Unknown payee')}`,
    `🏷 Category: ${preview.categoryName ? escapeHtml(preview.categoryName) : '⚠️ <b>Missing</b>'}`,
    `💵 Method: ${escapeHtml(preview.paymentMethodName ?? 'Cash')}`,
    `🕒 ${time12(preview.transactionTime ?? businessNow().time)}  ·  ${escapeHtml(preview.transactionDate ?? businessNow().date)}`,
    ...(preview.note ? ['', `📝 ${escapeHtml(preview.note)}`] : []),
    ...(preview.isNewPayee ? ['', '👤 <b>New payee will be created</b>'] : []),
    ...(preview.needsReview ? ['⚠️ This payment will go to Review'] : []),
    ...(preview.test ? ['', '🧪 <b>TEST MODE — nothing will be saved</b>'] : []),
    ...(preview.silent ? ['', '🔇 <b>silent</b> — no forward copy will be sent'] : []),
    ...preview.warnings
      .filter((warning) => warning.startsWith('Unusually high'))
      .map((warning) => `⚠️ ${escapeHtml(warning)}`)
  ].join('\n');

  const categoriesForPreview = (preview: ReturnType<LedgerService['previewQuickEntry']>) =>
    preview.categoryId ? [] : ledger.getMasterData().categories.map(({ id, name }) => ({ id, name }));

  const summaryText = (label: string) => {
    const dashboard = ledger.getDashboard();
    const categories = (ledger.getReports(dashboard.date, dashboard.date).categories as Array<{
      label: string;
      totalPaise: number;
    }>).slice(0, 3);
    return [
      `📊 <b>${escapeHtml(label)} payment summary</b>`,
      `📅 ${escapeHtml(dashboard.date)}`,
      '',
      `💰 <b>${money(dashboard.totalOutgoingPaise)}</b> total`,
      `🧾 ${dashboard.paymentCount} payments  ·  👥 ${dashboard.uniquePayeeCount} payees`,
      '',
      `💵 Cash: <b>${money(dashboard.cashPaise)}</b>`,
      `💳 Digital: <b>${money(dashboard.digitalPaise)}</b>`,
      `📈 Largest: <b>${money(dashboard.largestPaymentPaise)}</b>`,
      ...(categories.length > 0
        ? ['', '🏷 <b>Top categories</b>', ...categories.map((category) => `• ${escapeHtml(category.label)} — ${money(category.totalPaise)}`)]
        : []),
      '',
      dashboard.reviewCount > 0
        ? `⚠️ <b>${dashboard.reviewCount} payments need review</b>`
        : '✅ Nothing needs review'
    ].join('\n');
  };

  const sendToday = async (ctx: Context) => {
    await ctx.reply(summaryText('Today'), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🧾 Recent', 'panel:recent')
        .text('⚠️ Review', 'panel:review').row()
        .text('🔄 Refresh', 'panel:today')
    });
  };

  const sendRecent = async (ctx: Context) => {
    const items = ledger.listTransactions({ date: businessNow().date, pageSize: 5 }).items;
    if (items.length === 0) {
      await ctx.reply('🧾 <b>Recent payments</b>\n\nNo payments recorded today.', { parse_mode: 'HTML' });
      return;
    }
    const lines = items.flatMap((item, index) => [
      `<b>${index + 1}. ${escapeHtml(item.payeeName)}</b>  ·  ${money(item.amountPaise)}`,
      `🏷 ${escapeHtml(item.categoryName ?? '⚠️ Uncategorised')}  ·  ${escapeHtml(item.paymentMethodName ?? 'Cash')}  ·  ${time12(item.transactionTime)}`,
      ''
    ]);
    const keyboard = new InlineKeyboard();
    for (const item of items) keyboard.text(`#${item.id}`, `transaction:${item.id}`);
    keyboard.row().text('🔄 Refresh', 'panel:recent');
    await ctx.reply(`🧾 <b>Recent payments</b>\n\n${lines.join('\n').trim()}`, { parse_mode: 'HTML', reply_markup: keyboard });
  };

  const sendReview = async (ctx: Context) => {
    const items = ledger.listTransactions({ reviewOnly: true, pageSize: 5 }).items;
    if (items.length === 0) {
      await ctx.reply('✅ <b>Review inbox is clear</b>\nNothing needs your attention.', { parse_mode: 'HTML' });
      return;
    }
    const text = items
      .map((item) => {
        const reason = !item.categoryId
          ? 'Missing category'
          : !item.paymentMethodId
            ? 'Missing payment method'
            : 'Manual verification';
        return `<b>#${item.id} · ${escapeHtml(item.payeeName)}</b>\n💰 ${money(item.amountPaise)}\n⚠️ ${escapeHtml(reason)}`;
      })
      .join('\n\n');
    const keyboard = new InlineKeyboard();
    for (const item of items) keyboard.text(`#${item.id}`, `transaction:${item.id}`);
    await ctx.reply(`⚠️ <b>Needs review</b>\n\n${text}`, { parse_mode: 'HTML', reply_markup: keyboard });
  };

  const transactionText = (id: number, heading = 'Payment recorded') => {
    const item = ledger.getTransaction(id);
    return [
      `${heading.includes('recorded') ? '✅' : '🧾'} <b>${escapeHtml(heading)}</b>`,
      '',
      `💰 <b>${money(item.amountPaise)}</b>`,
      `👤 ${escapeHtml(item.payeeName)}`,
      `🏷 Category: ${item.categoryName ? escapeHtml(item.categoryName) : '⚠️ <b>Missing</b>'}`,
      `💵 Method: ${escapeHtml(item.paymentMethodName ?? 'Cash')}`,
      `🕒 ${time12(item.transactionTime)}  ·  ${escapeHtml(item.transactionDate)}`,
      ...(item.note ? ['', `📝 ${escapeHtml(item.note)}`] : []),
      '',
      `🔖 #${item.id}  ·  ${escapeHtml(item.source)}`,
      ...(item.needsReview ? ['⚠️ <b>Needs review</b>'] : [])
    ].join('\n');
  };

  bot.command('start', (ctx) => sendPanel(ctx, '✅ <b>Private Payment Ledger connected</b>\nUse the panel below—no commands needed.'));

  bot.hears(['Main Panel', panelLabels.main], (ctx) => sendPanel(ctx));
  bot.hears(['Record Payment', panelLabels.record], async (ctx) => {
    if (ctx.chat?.id) mode.set(ctx.chat.id, 'record');
    await ctx.reply('💸 <b>Record payment</b>\n\nSend one message with payee, amount and category. Cash is automatic.\n\n<code>Amit Kumar 3l wages "advance adjustment"</code>\n\nPrefix <code>test</code> to try without saving.\nPrefix <code>silent</code> to skip the forward copy.', { parse_mode: 'HTML' });
  });
  bot.hears(['Today', panelLabels.today], sendToday);
  bot.hears(['Recent Payments', panelLabels.recent], sendRecent);
  bot.hears(['Needs Review', panelLabels.review], sendReview);
  bot.hears(['Find Payee', panelLabels.find], async (ctx) => {
    if (ctx.chat?.id) mode.set(ctx.chat.id, 'find');
    await ctx.reply('🔎 <b>Find payee</b>\nType any part of the name or alias.', { parse_mode: 'HTML' });
  });

  bot.callbackQuery('panel:today', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendToday(ctx);
  });
  bot.callbackQuery('panel:recent', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendRecent(ctx);
  });
  bot.callbackQuery('panel:review', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendReview(ctx);
  });
  bot.callbackQuery(/^transaction:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    await ctx.reply(transactionText(id, 'Transaction details'), { parse_mode: 'HTML' });
  });
  bot.callbackQuery(/^payee:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const payeeId = Number(ctx.match[1]);
    const payee = ledger.getMasterData().payees.find((item) => item.id === payeeId);
    if (!payee) return;
    const recent = ledger.listTransactions({ payeeId, pageSize: 3 }).items;
    await ctx.reply([
      `👤 <b>${escapeHtml(payee.name)}</b>`,
      '',
      `💰 Total paid: <b>${money(payee.totalPaidPaise)}</b>`,
      `📅 This month: <b>${money(payee.thisMonthPaidPaise)}</b>`,
      `🧾 Payments: ${payee.paymentCount}`,
      ...(recent[0] ? [`🕒 Last: ${money(recent[0].amountPaise)} on ${escapeHtml(recent[0].transactionDate)}`] : [])
    ].join('\n'), { parse_mode: 'HTML' });
  });

  bot.callbackQuery('payment:cancel', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId) {
      pendingCommand.delete(chatId);
      mode.set(chatId, 'idle');
    }
    await ctx.answerCallbackQuery({ text: 'Cancelled' });
    await ctx.editMessageText('Payment cancelled.');
  });
  bot.callbackQuery('payment:edit', async (ctx) => {
    if (ctx.chat?.id) mode.set(ctx.chat.id, 'record');
    await ctx.answerCallbackQuery();
    await ctx.reply('Send the corrected payment text.');
  });
  bot.callbackQuery(/^payment:category:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    const command = chatId ? pendingCommand.get(chatId) : undefined;
    const category = ledger.getMasterData().categories.find((item) => item.id === Number(ctx.match[1]));
    if (!command || !category || !chatId) {
      await ctx.answerCallbackQuery({ text: 'Preview expired. Enter the payment again.' });
      return;
    }
    const noteSeparator = command.indexOf('//');
    const updatedCommand = noteSeparator === -1
      ? `${command} ${category.name}`
      : `${command.slice(0, noteSeparator).trim()} ${category.name} ${command.slice(noteSeparator)}`;
    const preview = ledger.previewQuickEntry(updatedCommand);
    pendingCommand.set(chatId, updatedCommand);
    await ctx.answerCallbackQuery({ text: `${category.name} selected` });
    await ctx.editMessageText(paymentPreviewText(preview), {
      parse_mode: 'HTML',
      reply_markup: previewKeyboard(categoriesForPreview(preview))
    });
  });

  const recordPending = async (ctx: Context, confirmDuplicate: boolean) => {
    const chatId = ctx.chat?.id;
    const command = chatId ? pendingCommand.get(chatId) : undefined;
    if (!command || !chatId) {
      await ctx.answerCallbackQuery({ text: 'Preview expired. Enter the payment again.' });
      return;
    }
    try {
      const result = await ledger.createFromCommand(command, {
        confirmNewPayee: true,
        confirmDuplicate,
        source: 'telegram'
      });
      if (result.testRun || !result.transaction) {
        pendingCommand.delete(chatId);
        mode.set(chatId, 'idle');
        const lines = [
          '🧪 <b>TEST MODE</b>',
          '',
          'Nothing was saved to the ledger.',
          result.duplicate && result.duplicateReason
            ? `⚠️ Would be flagged as duplicate: ${escapeHtml(result.duplicateReason)}`
            : '✅ This payment would have been recorded normally.'
        ];
        await ctx.answerCallbackQuery({ text: 'Test only — nothing saved' });
        await ctx.editMessageText(lines.join('\n'), { parse_mode: 'HTML' });
        await ctx.reply('🏠 What next?', { reply_markup: mainKeyboard() });
        return;
      }
      deliveredTransactionIds.add(result.transaction.id);
      pendingCommand.delete(chatId);
      mode.set(chatId, 'idle');
      await ctx.answerCallbackQuery({ text: 'Recorded' });
      await ctx.editMessageText(transactionText(result.transaction.id), { parse_mode: 'HTML' });
      await ctx.reply('✅ Saved. What would you like to do next?', { reply_markup: mainKeyboard() });
    } catch (error) {
      if (error instanceof Error && error.name === 'DuplicateTransactionError') {
        await ctx.answerCallbackQuery({ text: 'Possible duplicate' });
        await ctx.editMessageReplyMarkup({
          reply_markup: new InlineKeyboard()
            .text('Record Anyway', 'payment:record-anyway').row()
            .text('Edit', 'payment:edit')
            .text('Cancel', 'payment:cancel')
        });
        await ctx.reply(error.message);
        return;
      }
      await ctx.answerCallbackQuery({ text: 'Could not record payment' });
      await ctx.reply(error instanceof Error ? error.message : 'Payment could not be recorded.');
    }
  };

  bot.callbackQuery('payment:record', (ctx) => recordPending(ctx, false));
  bot.callbackQuery('payment:record-anyway', (ctx) => recordPending(ctx, true));

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;
    const chatId = ctx.chat?.id;
    const currentMode = chatId ? (mode.get(chatId) ?? 'idle') : 'idle';
    if (currentMode === 'find') {
      const query = text.toLocaleLowerCase('en-IN');
      const matches = ledger
        .getMasterData()
        .payees.filter((payee) =>
          [payee.name, ...payee.aliases].some((name) => name.toLocaleLowerCase('en-IN').includes(query))
        )
        .slice(0, 8);
      if (matches.length === 0) {
        await ctx.reply('No matching payee found. Try another spelling.');
        return;
      }
      const keyboard = new InlineKeyboard();
      for (const payee of matches) keyboard.text(payee.name, `payee:${payee.id}`).row();
      await ctx.reply('Select a payee:', { reply_markup: keyboard });
      return;
    }
    if (currentMode !== 'record') {
      await sendPanel(ctx, 'Choose an action from the panel.');
      return;
    }
    try {
      const preview = ledger.previewQuickEntry(text);
      if (!preview.valid || !preview.payeeName || !preview.amountPaise) {
        await ctx.reply(preview.errors.join('\n') || 'Payment is incomplete.');
        return;
      }
      if (chatId) pendingCommand.set(chatId, text);
      await ctx.reply(paymentPreviewText(preview), {
        parse_mode: 'HTML',
        reply_markup: previewKeyboard(categoriesForPreview(preview))
      });
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : 'Payment could not be understood.');
    }
  });

  bot.catch((error) => {
    process.stderr.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'telegram_update_failed',
      error: error.error instanceof Error ? error.error.message : 'Unknown Telegram error'
    })}\n`);
  });

  const initialiseForwardCursor = () => {
    const key = 'telegram.last_forwarded_transaction_id';
    if (getSetting(runtime, key) !== null) return;
    const row = runtime.sqlite.prepare('SELECT coalesce(max(id), 0) AS id FROM transactions').get() as { id: number };
    setSetting(runtime, key, String(row.id));
  };

  const forwardTransactions = async () => {
    if (forwarding || stopped) return;
    forwarding = true;
    try {
      if (getSetting(runtime, 'telegram.forward.enabled') === 'false') {
        if (!forwardPauseLogged) {
          forwardPauseLogged = true;
          process.stdout.write(`${JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'telegram_forward_paused'
          })}\n`);
        }
        return;
      }
      forwardPauseLogged = false;
      const key = 'telegram.last_forwarded_transaction_id';
      const lastId = Number(getSetting(runtime, key) ?? '0');
      const rows = runtime.sqlite
        .prepare('SELECT id, silent FROM transactions WHERE id > ? ORDER BY id LIMIT 50')
        .all(lastId) as Array<{ id: number; silent: number }>;
      for (const row of rows) {
        if (row.silent === 1) {
          setSetting(runtime, key, String(row.id));
          continue;
        }
        if (!deliveredTransactionIds.delete(row.id)) {
          for (const chatId of allowedChatIds) {
            await bot.api.sendMessage(chatId, transactionText(row.id, 'New payment recorded'), {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text('Details', `transaction:${row.id}`)
            }).catch((error: unknown) => {
              process.stderr.write(`${JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'warn',
                message: 'telegram_forward_send_failed',
                transaction_id: row.id,
                chat_id: chatId,
                error: error instanceof Error ? error.message : 'Unknown Telegram send error'
              })}\n`);
            });
          }
        }
        setSetting(runtime, key, String(row.id));
      }
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'telegram_forward_retry_pending',
        error: error instanceof Error ? error.message : 'Unknown error'
      })}\n`);
    } finally {
      forwarding = false;
    }
  };

  const sendScheduledSummaries = async () => {
    if (stopped) return;
    if (getSetting(runtime, 'telegram.summaries.enabled') === 'false') {
      if (!summaryPauseLogged) {
        summaryPauseLogged = true;
        process.stdout.write(`${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'telegram_summaries_paused'
        })}\n`);
      }
      return;
    }
    summaryPauseLogged = false;
    const now = businessNow();
    const minute = now.time.slice(0, 5);
    const configured = (process.env.TELEGRAM_SUMMARY_TIMES ?? '18:00,20:00')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (const scheduled of configured) {
      if (minute < scheduled) continue;
      const key = `telegram.summary.${scheduled}.last_date`;
      if (getSetting(runtime, key) === now.date) continue;
      const label = scheduled === '18:00' ? '6 PM' : scheduled === '20:00' ? '8 PM' : scheduled;
      try {
        for (const chatId of allowedChatIds) {
          await bot.api.sendMessage(chatId, summaryText(label), {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('🧾 Recent', 'panel:recent')
              .text('⚠️ Review', 'panel:review').row()
              .text('🔄 Refresh', 'panel:today')
          }).catch(() => undefined);
        }
        setSetting(runtime, key, now.date);
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'telegram_summary_retry_pending',
          schedule: scheduled,
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n`);
      }
    }
  };

  initialiseForwardCursor();
  const forwardIntervalMs = Math.max(5_000, Number(process.env.TELEGRAM_FORWARD_INTERVAL_MS || 15_000));
  const forwardTimer = setInterval(() => void forwardTransactions(), forwardIntervalMs);
  const scheduleTimer = setInterval(() => void sendScheduledSummaries(), 30_000);
  void bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: async (info) => {
      process.stdout.write(`${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'telegram_started',
        bot: info.username
      })}\n`);
      if (getSetting(runtime, 'telegram.panel.version') !== '2') {
        for (const chatId of allowedChatIds) {
          await bot.api.sendMessage(chatId, '✅ <b>Private Payment Ledger connected</b>\nUse the panel below—no commands needed.', {
            parse_mode: 'HTML',
            reply_markup: mainKeyboard()
          }).catch(() => undefined);
        }
        setSetting(runtime, 'telegram.panel.version', '2');
      }
      void forwardTransactions();
      void sendScheduledSummaries();
    }
  });

  return {
    async stop() {
      stopped = true;
      clearInterval(forwardTimer);
      clearInterval(scheduleTimer);
      await bot.stop();
    }
  };
}
