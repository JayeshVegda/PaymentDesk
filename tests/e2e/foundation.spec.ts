import { expect, test } from '@playwright/test';

test('production page and health endpoint are available', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Payees' }).click();
  await expect(page.getByRole('heading', { name: 'Master Registers' })).toBeVisible();
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toEqual({ status: 'ok', version: '0.1.0', database: 'ok' });
});
