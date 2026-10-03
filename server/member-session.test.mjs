import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './index.mjs';

async function setup(t, handler) {
  const server = createGateway({ baseUrl: 'https://example.test/api', token: 'test-token-aaaaaaaaaaaaaaaaaaaa' }, handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, body, cookie) => fetch(`${base}/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}
const json = value => new Response(JSON.stringify(value), { status: 200 });
const login = 'MemberLogin/MemberMobileLoginGetProfile';
const details = 'MemberDetails/GetMemberDetails';
const phone = '0123456789';

test('profile requires a confirmed session, rejects other phones and strips secrets', async t => {
  let calls = 0;
  const post = await setup(t, async (url, options) => {
    calls++;
    if (url.endsWith('/MemberMobileLoginGetProfile')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.Phone, phone);
      assert.equal(payload.OTP, 'test-otp');
      assert.equal(payload.PhoneNumber, undefined);
      return json({ success: true });
    }
    assert.deepEqual(JSON.parse(options.body), { PhoneNumber: phone });
    return json({ Name: 'Member A', PhoneNumber: phone, Balance: 25.5, Point: 100,
      TotalStamp: 3, Password: 'secret', DeviceId: 'secret-device' });
  });
  assert.equal((await post(details, { PhoneNumber: phone })).status, 401);
  assert.equal(calls, 0);
  const signedIn = await post(login, { PhoneNumber: phone, OtpCode: 'test-otp' });
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal((await post(details, { PhoneNumber: '999' }, cookie)).status, 403);
  const response = await post(details, {}, cookie);
  assert.equal(response.status, 200);
  const profile = await response.json();
  assert.equal(profile.Name, 'Member A');
  assert.equal(profile.Balance, 25.5);
  assert.equal(profile.Password, undefined);
  assert.equal(profile.DeviceId, undefined);
  assert.equal(calls, 2);
});

test('HTTP 200 with failed or unknown login result does not establish a session', async t => {
  const post = await setup(t, async () => json({ success: false, message: 'Invalid OTP' }));
  const response = await post(login, { PhoneNumber: phone, OtpCode: 'bad' });
  assert.equal(response.status, 502);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await post(details, { PhoneNumber: phone }, response.headers.get('set-cookie'))).status, 401);
});

test('API profile for a different account is rejected', async t => {
  const post = await setup(t, async url => url.endsWith('/MemberMobileLoginGetProfile')
    ? json({ PhoneNumber: phone, Name: 'Member A' })
    : json({ PhoneNumber: '999', Name: 'Member B' }));
  const response = await post(login, { PhoneNumber: phone, OtpCode: 'test-otp' });
  assert.equal((await post(details, {}, response.headers.get('set-cookie'))).status, 502);
});

test('email login attaches backend authorization, creates a session and hides secrets', async t => {
  const post = await setup(t, async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token-aaaaaaaaaaaaaaaaaaaa');
    if (url.endsWith('/CheckEmailPassword')) {
      assert.deepEqual(JSON.parse(options.body), { Email: 'member@example.test', Password: 'test-password' });
      return json({ Email: 'member@example.test', PhoneNumber: phone, Name: 'Member', Password: 'test-password' });
    }
    return json({ PhoneNumber: phone, Name: 'Member' });
  });
  const response = await post('MemberLogin/CheckEmailPassword', { Email: 'member@example.test', Password: 'test-password' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).Password, undefined);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await post(details, {}, response.headers.get('set-cookie'))).status, 200);
});

test('unconfirmed email login cannot create a member session', async t => {
  const post = await setup(t, async () => json({ success: true }));
  const response = await post('MemberLogin/CheckEmailPassword', { Email: 'member@example.test', Password: 'test-password' });
  assert.equal(response.status, 502);
  assert.equal((await post(details, {}, response.headers.get('set-cookie'))).status, 401);
});
