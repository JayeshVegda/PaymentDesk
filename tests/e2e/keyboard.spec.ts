import { expect, test } from '@playwright/test';

test.describe('Keyboard-only Workflows', () => {
  test('navigates, parses command, autocomplete selection, and posts via keyboard', async ({ page }) => {
    const master = await (await page.request.get('/api/master-data?includeInactive=true')).json();
    const category = master.categories.find((item: { name: string }) => item.name === 'Raw Material');
    const method = master.paymentMethods.find((item: { code: string }) => item.code === 'cash');
    const existing = master.payees.find((item: { name: string }) => item.name === 'Ramesh Kumar');
    const payee = existing ?? await (await page.request.post('/api/payees', { data: {
      type: 'person',
      name: 'Ramesh Kumar',
      aliases: ['ramesh'],
      defaultCategoryId: category.id,
      defaultPaymentMethodId: method.id
    } })).json();

    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.keyboard.press('g');
      await page.keyboard.press('r');
      await expect(page.getByRole('heading', { name: 'Review Inbox', level: 1 })).toBeVisible();

      await page.keyboard.press('Alt+1');
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
      await page.keyboard.press('/');
      const entryInput = page.locator('input[placeholder^="Payee, amount"]');
      await expect(entryInput).toBeFocused();

      await page.keyboard.type('ramesh k', { delay: 20 });
      await expect(page.locator('[role="listbox"]')).toBeVisible();
      await expect(entryInput).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Enter');
      await expect(entryInput).toHaveValue(/Ramesh Kumar/i);

      const randomAmount = Math.floor(Math.random() * 899) + 100;
      await page.keyboard.type(` ${randomAmount}`, { delay: 20 });

      await expect(page.getByText('Parsed payment')).toBeVisible();
      await expect(page.locator('strong').filter({ hasText: 'Ramesh Kumar' }).first()).toBeVisible();
      // Enter saves instantly — no confirmation dialog for a known payee
      await page.keyboard.press('Enter');
      await expect(page.locator('table').getByRole('cell', { name: 'Ramesh Kumar' }).first()).toBeVisible();
      await expect(entryInput).toBeFocused();
      await expect(entryInput).toHaveValue('');
    } finally {
      if (!existing) {
        await page.request.delete(`/api/payees/${payee.id}?force=true`, {
          data: { confirm: `DELETE ${payee.name}` }
        });
      }
    }
  });

  test('gates new payees behind an inline second-Enter confirmation', async ({ page }) => {
    const master = await (await page.request.get('/api/master-data?includeInactive=true')).json();
    const clash = master.payees.find((item: { name: string }) => item.name === 'Zeta Gate Test');
    if (clash) await page.request.delete(`/api/payees/${clash.id}?force=true`, { data: { confirm: 'DELETE Zeta Gate Test' } });

    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
      await page.keyboard.press('/');
      const entryInput = page.locator('input[placeholder^="Payee, amount"]');
      await expect(entryInput).toBeFocused();

      await page.keyboard.type('zeta gate test 250 tools cash', { delay: 10 });
      // Wait for the live parse preview before pressing Enter (debounced parse)
      await expect(page.getByText('Parsed payment')).toBeVisible();
      await expect(entryInput).toHaveValue(/zeta gate test/i);
      // First Enter arms the inline gate — no dialog, nothing saved
      await page.keyboard.press('Enter');
      const gate = page.getByRole('alert').filter({ hasText: 'New payee "Zeta Gate Test" will be created' });
      await expect(gate).toBeVisible();
      await expect(entryInput).toHaveValue(/zeta gate test/i);

      // Escape disarms the gate
      await page.keyboard.press('Escape');
      await expect(page.getByRole('alert')).toHaveCount(0);

      // Enter arms it again, second Enter confirms creation and saves
      await page.keyboard.press('Enter');
      await expect(gate).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page.locator('table').getByRole('cell', { name: /zeta gate test/i }).first()).toBeVisible();
    } finally {
      const list = await (await page.request.get('/api/master-data?includeInactive=true')).json();
      const created = list.payees.find((item: { name: string }) => item.name === 'Zeta Gate Test');
      if (created) {
        await page.request.delete(`/api/payees/${created.id}?force=true`, {
          data: { confirm: 'DELETE Zeta Gate Test' }
        });
      }
    }
  });
});
