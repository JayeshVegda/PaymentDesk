/**
 * Money formatting helpers for Payment Desk Reports
 * Sourced from integer paise values (1 INR = 100 paise)
 */

export function formatInrFull(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(rupees);
}

export function formatCompactINR(paise: number): string {
  if (!paise || isNaN(paise)) return '₹0';
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? '-' : '';

  if (rupees >= 10000000) {
    // 1 Crore = 1,00,00,000
    const cr = rupees / 10000000;
    return `${sign}₹${cr.toFixed(2)}Cr`;
  }
  if (rupees >= 100000) {
    // 1 Lakh = 1,00,000
    const lakh = rupees / 100000;
    return `${sign}₹${lakh.toFixed(2)}L`;
  }
  if (rupees >= 1000) {
    // Thousands = k
    const k = rupees / 1000;
    return `${sign}₹${k.toFixed(1)}k`;
  }

  return `${sign}₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
