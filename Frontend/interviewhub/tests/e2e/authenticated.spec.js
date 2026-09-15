import { test, expect } from '@playwright/test';

const AUTH_TOKEN = 'playwright-auth-token';
const AUTHORIZATION = `Bearer ${AUTH_TOKEN}`;
const CURRENT_USER_ID = '111111111111111111111111';
const OTHER_USER_ID = '222222222222222222222222';
const EXPERIENCE_ID = '333333333333333333333333';
const COMMENT_ID = '444444444444444444444444';
const AVATAR = 'http://127.0.0.1:4173/test-avatar.svg';
const CURRENT_USER = {
  _id: CURRENT_USER_ID,
  name: 'Playwright Student',
  email: 'playwright.student@mgit.ac.in',
  department: 'CSE',
  graduationYear: '2027',
  rollNumber: '22R11A0001',
  currentlyStudying: 'B.Tech',
  phoneNumber: '9876543210',
  avatar: AVATAR,
};
const OTHER_USER = {
  _id: OTHER_USER_ID,
  name: 'Senior Student',
  department: 'IT',
  avatar: AVATAR,
};
const EXPERIENCE = {
  _id: EXPERIENCE_ID,
  user: OTHER_USER,
  company: 'Mock Systems',
  role: 'Backend Engineer',
  difficulty: 'Medium',
  roundDate: '2026-01-15T10:00:00.000Z',
  description: 'A deterministic mocked interview experience for browser testing.',
  tips: 'Explain your approach clearly.',
  rounds: [{ roundName: 'Technical', questions: 'Explain a hash table.', duration: '30' }],
  upvotes: 2,
  downvotes: 0,
  createdAt: '2026-01-16T10:00:00.000Z',
};
const COMMENT = {
  _id: COMMENT_ID,
  user: OTHER_USER,
  text: 'Mocked comment body',
  createdAt: '2026-01-17T10:00:00.000Z',
  parentCommentId: null,
};

const fulfillJson = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

function recordRequest(route, requests) {
  const request = route.request();
  const record = {
    method: request.method(),
    url: request.url(),
    authorization: request.headers().authorization,
    body: request.postData() ? request.postDataJSON() : null,
  };
  requests.push(record);
  expect(record.authorization, `${record.method} ${record.url}`).toBe(AUTHORIZATION);
  return record;
}

async function installAuthenticatedSession(page, baseURL) {
  await page.addInitScript(token => localStorage.setItem('authToken', token), AUTH_TOKEN);
  // Register the guard first: Playwright runs the last matching route first.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/') || url.origin !== new URL(baseURL).origin) {
      await route.abort();
      throw new Error(`Unexpected request: ${route.request().method()} ${url.href}`);
    }
    await route.continue();
  });
  const fulfillAvatar = route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#6366f1"/></svg>',
  });
  await page.route('**/test-avatar.svg', fulfillAvatar);
  await page.route('https://api.dicebear.com/**', fulfillAvatar);
}

test('authenticated home renders mocked content and applies an upvote', async ({ page, baseURL }) => {
  const requests = [];
  await installAuthenticatedSession(page, baseURL);
  const getMocks = [
    ['**/api/auth/me', CURRENT_USER],
    ['**/api/experiences?*', { experiences: [EXPERIENCE], totalPages: 1 }],
    [`**/api/comments/experience/${EXPERIENCE_ID}/count`, { count: 1 }],
    [`**/api/comments/experience/${EXPERIENCE_ID}`, [COMMENT]],
  ];
  for (const [pattern, response] of getMocks) {
    await page.route(pattern, async route => {
      expect(recordRequest(route, requests).method).toBe('GET');
      await fulfillJson(route, response);
    });
  }
  await page.route(`**/api/experiences/${EXPERIENCE_ID}/upvote`, async route => {
    expect(recordRequest(route, requests).method).toBe('POST');
    await fulfillJson(route, { upvotes: 97, downvotes: 0 });
  });

  await page.goto('/home');
  await expect(page).toHaveURL('/home');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByText('Welcome, Playwright Student', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mock Systems', exact: true })).toBeVisible();
  await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible();
  // The difficulty filter also contains a Medium option; assert the card's badge.
  await expect(page.getByText('Medium', { exact: true }).and(page.locator('span'))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Senior Student', exact: true })).toBeVisible();
  const comments = page.getByRole('button', { name: '1 Comment', exact: true });
  await expect(comments).toBeVisible();
  await comments.click();
  await expect(page.getByText('Mocked comment body', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upvote', exact: true }).click();
  await expect(page.getByText('97', { exact: true })).toBeVisible();

  const upvote = requests.find(request => new URL(request.url).pathname.endsWith('/upvote'));
  expect(upvote).toMatchObject({ method: 'POST', authorization: AUTHORIZATION });
  expect(upvote.body).toEqual({});
  const list = requests.find(request => new URL(request.url).pathname === '/api/experiences');
  const query = new URL(list.url).searchParams;
  expect(query.get('page')).toBe('1');
  expect(query.get('limit')).toBe('10');
  expect(query.get('sortOrder')).toBe('latest');
  expect(requests.map(request => new URL(request.url).pathname)).toEqual(expect.arrayContaining([
    '/api/auth/me',
    '/api/experiences',
    `/api/comments/experience/${EXPERIENCE_ID}/count`,
    `/api/comments/experience/${EXPERIENCE_ID}`,
    `/api/experiences/${EXPERIENCE_ID}/upvote`,
  ]));
  for (const request of requests) expect(request.authorization).toBe(AUTHORIZATION);
  await expect(page).toHaveURL('/home');
});

test('profile keeps account fields protected and submits only editable fields', async ({ page, baseURL }) => {
  const requests = [];
  const updatedUser = { ...CURRENT_USER, name: 'Updated Playwright Student', phoneNumber: '9000000000' };
  await installAuthenticatedSession(page, baseURL);
  await page.route('**/api/auth/me', async route => {
    const request = recordRequest(route, requests);
    expect(['GET', 'PUT']).toContain(request.method);
    await fulfillJson(route, request.method === 'PUT' ? updatedUser : CURRENT_USER);
  });
  await page.route(`**/api/experiences/user/${CURRENT_USER_ID}`, async route => {
    expect(recordRequest(route, requests).method).toBe('GET');
    await fulfillJson(route, []);
  });

  await page.goto('/profile');
  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('heading', { name: CURRENT_USER.name, exact: true })).toBeVisible();
  await expect(page.getByText('CSE', { exact: true })).toBeVisible();
  await expect(page.getByText(CURRENT_USER.email)).toBeVisible();
  await expect(page.getByText("You haven't posted anything yet.", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const accountDetails = page.getByRole('region', { name: 'Account details', exact: true });
  await expect(accountDetails).toBeVisible();
  await expect(accountDetails.getByText('Department:', { exact: true })).toBeVisible();
  await expect(accountDetails).toContainText('CSE');
  await expect(accountDetails.getByText('College Email:', { exact: true })).toBeVisible();
  await expect(accountDetails).toContainText(CURRENT_USER.email);
  await expect(accountDetails.getByText(
    'Email and department are tied to your verified college account and cannot be changed from your profile.',
    { exact: true },
  )).toBeVisible();
  for (const label of ['Department', 'College Email', 'Email']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  for (const [label, value] of [
    ['Name', CURRENT_USER.name],
    ['Graduation Year', CURRENT_USER.graduationYear],
    ['Roll Number', CURRENT_USER.rollNumber],
    ['Currently Studying', CURRENT_USER.currentlyStudying],
    ['Phone Number', CURRENT_USER.phoneNumber],
  ]) {
    const input = page.getByRole('textbox', { name: label, exact: true });
    await expect(input).toBeEditable();
    await expect(input).toHaveValue(value);
  }
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(updatedUser.name);
  await page.getByRole('textbox', { name: 'Phone Number', exact: true }).fill(updatedUser.phoneNumber);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Profile updated!', { exact: true })).toBeVisible();

  const update = requests.find(request => request.method === 'PUT');
  expect(update).toMatchObject({ method: 'PUT', authorization: AUTHORIZATION });
  expect(update.body).toEqual({
    name: 'Updated Playwright Student',
    graduationYear: '2027',
    rollNumber: '22R11A0001',
    currentlyStudying: 'B.Tech',
    phoneNumber: '9000000000',
    avatar: AVATAR,
  });
  for (const key of ['email', 'department', '_id', 'password', 'isVerified', 'otp', 'otpExpiry', 'unexpected']) {
    expect(update.body).not.toHaveProperty(key);
  }
  expect(requests.filter(request => request.method === 'GET').map(request => new URL(request.url).pathname))
    .toEqual(expect.arrayContaining(['/api/auth/me', `/api/experiences/user/${CURRENT_USER_ID}`]));
  for (const request of requests) expect(request.authorization).toBe(AUTHORIZATION);
  await expect(page.getByRole('heading', { name: updatedUser.name, exact: true })).toBeVisible();
  await expect(page.getByText('CSE', { exact: true })).toBeVisible();
  await expect(page.getByText(CURRENT_USER.email)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('user')))).toEqual(updatedUser);
  await expect(page).toHaveURL('/profile');
});
