const AMOUNT_TOKEN = /^(?<number>(?:\d+(?:\.\d+)?|\.\d+))\s*(?<suffix>k|l|lac|lakh)?$/i;

export function normalizeLookupText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-IN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAmountTokenToPaise(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  const usesLakh = /(?:l|lac|lakh)$/.test(trimmed);
  const decimalLakh = usesLakh && /^\d,\d{1,2}\s*(?:l|lac|lakh)$/.test(trimmed);
  const normalized = decimalLakh ? trimmed.replace(',', '.') : trimmed.replaceAll(',', '');
  const match = AMOUNT_TOKEN.exec(normalized);
  if (!match?.groups) return null;

  const numericText = match.groups.number;
  if (!numericText) return null;
  const [whole = '0', fraction = ''] = numericText.split('.');
  const suffix = match.groups.suffix?.toLowerCase();
  const multiplierRupees =
    suffix === 'k' ? 1_000 : suffix && ['l', 'lac', 'lakh'].includes(suffix) ? 100_000 : 1;
  const decimalPlaces = fraction.length;
  const numerator = BigInt(`${whole}${fraction}`) * BigInt(multiplierRupees) * 100n;
  const denominator = 10n ** BigInt(decimalPlaces);

  if (numerator % denominator !== 0n) return null;
  const paise = numerator / denominator;
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(paise);
}

export interface ParserPayee {
  id: number;
  name: string;
  normalizedNames: string[];
  defaultCategoryId: number | null;
  defaultPaymentMethodId: number | null;
}

export interface ParserCategory {
  id: number;
  name: string;
  normalizedNames: string[];
}

export interface ParserPaymentMethod {
  id: number;
  code: string;
  displayName: string;
  aliases: string[];
}

export interface QuickEntryContext {
  payees: ParserPayee[];
  categories: ParserCategory[];
  paymentMethods: ParserPaymentMethod[];
}

export interface QuickEntryPreview {
  command: string;
  valid: boolean;
  payeeId: number | null;
  payeeName: string | null;
  isNewPayee: boolean;
  amountPaise: number | null;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  note: string | null;
  needsReview: boolean;
  test: boolean;
  silent: boolean;
  errors: string[];
  warnings: string[];
}

function phraseContained(command: string, phrase: string): boolean {
  return ` ${command} `.includes(` ${phrase} `);
}

function normalizeCommand(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-IN')
    .replace(/[^\p{L}\p{N}.,:/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removePhrase(command: string, phrase: string): string {
  const normalizedCommand = normalizeCommand(command);
  const normalizedPhrase = normalizeCommand(phrase);
  return normalizeCommand(` ${normalizedCommand} `.replace(` ${normalizedPhrase} `, ' '));
}

function titleCasePayeeName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toLocaleUpperCase('en-IN')}${word.slice(1)}`)
    .join(' ');
}

function extractModeKeywords(command: string): {
  command: string;
  test: boolean;
  silent: boolean;
} {
  let remaining = command.trim();
  let test = false;
  let silent = false;
  for (;;) {
    const match = /^(test|silent)\b\s*/i.exec(remaining);
    if (!match) break;
    if (match[1]?.toLowerCase() === 'test') test = true;
    else silent = true;
    remaining = remaining.slice(match[0].length);
  }
  return { command: remaining, test, silent };
}

function extractNotes(command: string): { commandToParse: string; explicitNote: string } {
  const separatorIndex = command.indexOf('//');
  const beforeSeparator = separatorIndex === -1 ? command : command.slice(0, separatorIndex);
  const notes: string[] = [];
  if (separatorIndex !== -1) {
    const trailingNote = command.slice(separatorIndex + 2).trim();
    if (trailingNote) notes.push(trailingNote);
  }

  const commandToParse = beforeSeparator.replace(/["“]([^"”]+)["”]/g, (_match, note: string) => {
    const cleaned = note.trim();
    if (cleaned) notes.unshift(cleaned);
    return ' ';
  });

  return { commandToParse, explicitNote: notes.join(' ').trim() };
}

export function parseQuickEntry(command: string, context: QuickEntryContext): QuickEntryPreview {
  const mode = extractModeKeywords(command);
  const { commandToParse, explicitNote } = extractNotes(mode.command);

  let remaining = normalizeCommand(commandToParse);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (mode.test) warnings.push('TEST MODE — nothing will be saved');
  if (mode.silent) warnings.push('SILENT — Telegram forwarding skipped');

  const payeeMatches = context.payees
    .flatMap((payee) =>
      payee.normalizedNames
        .filter((name) => name && phraseContained(remaining, name))
        .map((name) => ({ payee, name }))
    )
    .sort((left, right) => right.name.length - left.name.length);
  const longestPayeeLength = payeeMatches[0]?.name.length ?? 0;
  const longestPayees = payeeMatches.filter((match) => match.name.length === longestPayeeLength);
  const payeeIds = new Set(longestPayees.map((match) => match.payee.id));
  let payee = payeeIds.size === 1 ? longestPayees[0]?.payee : undefined;
  const matchedPayeeName = longestPayees[0]?.name ?? '';
  if (!payee && payeeIds.size > 1) errors.push('Payee is ambiguous');
  if (payee && longestPayees[0]) remaining = removePhrase(remaining, longestPayees[0].name);

  const amountTokens = remaining.split(' ');
  const amountCandidates: string[] = [];
  for (let index = 0; index < amountTokens.length; index += 1) {
    const token = amountTokens[index] ?? '';
    const next = amountTokens[index + 1]?.toLowerCase();
    if (next && ['l', 'lac', 'lakh'].includes(next)) {
      amountCandidates.push(`${token} ${next}`);
      index += 1;
    } else {
      amountCandidates.push(token);
    }
  }
  const amountMatches = [...new Set(amountCandidates)]
    .filter(Boolean)
    .map((token) => ({ token, amountPaise: parseAmountTokenToPaise(token) }))
    .filter((match): match is { token: string; amountPaise: number } => match.amountPaise !== null);
  const amount = amountMatches[0];
  if (!amount) {
    errors.push('No valid amount found');
  } else {
    if (amount.amountPaise > 5000000000) {
      errors.push('Amount exceeds ₹50,00,000 limit');
    }
    remaining = removePhrase(remaining, amount.token);
  }

  let newPayeeName: string | null = null;
  let forceNewPayee = false;
  if (payee && amount) {
    const normalizedOriginal = normalizeCommand(commandToParse);
    const amountPosition = normalizedOriginal.indexOf(amount.token);
    let identityPrefix =
      amountPosition >= 0 ? normalizedOriginal.slice(0, amountPosition).trim() : '';
    identityPrefix = identityPrefix
      .replace(/\b(?:today|yesterday)\b/gi, '')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .trim();
    if (identityPrefix !== matchedPayeeName) {
      payee = undefined;
      forceNewPayee = true;
      remaining = removePhrase(normalizedOriginal, amount.token);
    }
  }
  if (!payee && (payeeIds.size === 0 || forceNewPayee) && amount) {
    const amountPosition = normalizeCommand(commandToParse).indexOf(amount.token);
    const prefix =
      amountPosition >= 0 ? normalizeCommand(commandToParse).slice(0, amountPosition).trim() : '';
    if (prefix.length >= 2 && !parseAmountTokenToPaise(prefix)) {
      newPayeeName = titleCasePayeeName(
        prefix.replace(/\b(?:today|yesterday)\b/gi, '').trim()
      );
      if (newPayeeName) remaining = removePhrase(remaining, newPayeeName);
    }
    if (!newPayeeName) errors.push('Enter a payee name before the amount');
  }

  const methodMatches = context.paymentMethods.flatMap((method) =>
    method.aliases
      .filter((alias) => phraseContained(remaining, alias))
      .map((alias) => ({ method, alias }))
  );
  const explicitMethod = methodMatches.length === 1 ? methodMatches[0] : undefined;
  if (methodMatches.length > 1) errors.push('Payment method is ambiguous');
  if (explicitMethod) remaining = removePhrase(remaining, explicitMethod.alias);
  const cashMethod = context.paymentMethods.find((method) => method.code === 'cash');
  // Cash is the desk-wide default. A different method must be written explicitly.
  const paymentMethodId = explicitMethod?.method.id ?? cashMethod?.id ?? null;
  const paymentMethod = context.paymentMethods.find((method) => method.id === paymentMethodId);

  const categoryMatches = context.categories
    .flatMap((category) =>
      category.normalizedNames
        .filter((name) => name && phraseContained(remaining, name))
        .map((name) => ({ category, name }))
    )
    .sort((left, right) => right.name.length - left.name.length);
  const category = categoryMatches[0]?.category;
  if (categoryMatches[0]) remaining = removePhrase(remaining, categoryMatches[0].name);
  const categoryId = category?.id ?? payee?.defaultCategoryId ?? null;
  const resolvedCategory = context.categories.find((entry) => entry.id === categoryId);

  if (newPayeeName) warnings.push('New payee will be created');
  if (!paymentMethodId) warnings.push('Payment method needs review');
  if (!categoryId) warnings.push('Category needs review');
  const needsReview = !paymentMethodId || !categoryId;

  let finalNote = remaining;
  if (explicitNote) {
    finalNote = finalNote ? `${explicitNote} ${finalNote}` : explicitNote;
  }

  return {
    command,
    valid: errors.length === 0,
    payeeId: payee?.id ?? null,
    payeeName: payee?.name ?? newPayeeName,
    isNewPayee: Boolean(newPayeeName),
    amountPaise: amount?.amountPaise ?? null,
    categoryId,
    categoryName: resolvedCategory?.name ?? null,
    paymentMethodId,
    paymentMethodName: paymentMethod?.displayName ?? null,
    transactionDate: null,
    transactionTime: null,
    note: finalNote || null,
    needsReview,
    test: mode.test,
    silent: mode.silent,
    errors,
    warnings
  };
}
