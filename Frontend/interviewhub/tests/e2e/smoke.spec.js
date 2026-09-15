import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('authToken'));
});

test('landing page leads to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Real interview experiences, passed forward.', exact: true })).toBeVisible();
  const signIn = page.getByRole('button', { name: 'Sign In / Sign Up', exact: true });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back!', exact: true })).toBeVisible();
});

test('auth page toggles between sign in and sign up', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back!', exact: true })).toBeVisible();
  // The page repeats these actions below the form; use the first, top toggle.
  await page.getByRole('button', { name: 'Sign Up', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Create Your Account', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Department', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign In', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Welcome Back!', exact: true })).toBeVisible();
});

for (const route of ['/home', '/profile', '/message', '/user/111111111111111111111111']) {
  test(`unauthenticated ${route} redirects to sign in`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Welcome Back!', exact: true })).toBeVisible();
  });
}
