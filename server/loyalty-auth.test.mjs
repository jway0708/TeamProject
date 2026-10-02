import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthorization } from './loyalty-auth.mjs';
import { createGateway } from './index.mjs';

const tokenA = 'test-token-aaaaaaaaaaaaaaaaaaaa';
const tokenB = 'test-token-bbbbbbbbbbbbbbbbbbbb';
const config = { baseUrl: 'https://example.test/api', username: 'test user', password: 'test&password' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('credentials use query parameters; Bearer token is cached for concurrent requests', async () => {
  let logins = 0;
  let posts = 0;
  const auth = createAuthorization(config, async (url, options) => {
    if (String(url).includes('/JWTToken/Post')) {
      logins++;
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get('UserName'), config.username);
      assert.equal(parsed.searchParams.get('Password'), config.password);
      assert.equal(options.method, 'POST');
      assert.equal(options.body, undefined);
      return json({ Token: tokenA });
    }
    posts++;
    assert.equal(options.headers.Authorization, `Bearer ${tokenA}`);
    assert.deepEqual(JSON.parse(options.body), { PhoneNumber: 'test-phone' });
    return json({ success: true });
  });
  await Promise.all([1, 2, 3].map(() => auth.post('/MemberAccount/RequestOTP', { PhoneNumber: 'test-phone' })));
  assert.equal(logins, 1);
  assert.equal(posts, 3);
});

test('401 refreshes the token once and retries with the new token', async () => {
  let logins = 0;
  let posts = 0;
  const auth = createAuthorization(config, async (url, options) => {
    if (String(url).includes('/JWTToken/Post')) return json(++logins === 1 ? tokenA : tokenB);
    posts++;
    assert.equal(options.headers.Authorization, `Bearer ${posts === 1 ? tokenA : tokenB}`);
    return json({}, 401);
  });
  assert.equal((await auth.post('/MemberAccount/RegisterOtp', {})).status, 401);
  assert.equal(logins, 2);
  assert.equal(posts, 2);
});

test('fixed tokens do not call the credential endpoint or retry 401', async () => {
  let calls = 0;
  const auth = createAuthorization({ ...config, token: `Bearer ${tokenA}` }, async (url, options) => {
    calls++;
    assert.equal(url, `${config.baseUrl}/MemberAccount/RequestOTP`);
    assert.equal(options.headers.Authorization, `Bearer ${tokenA}`);
    return json({}, 401);
  });
  await auth.post('/MemberAccount/RequestOTP', {});
  assert.equal(calls, 1);
});

test('missing credentials and unrecognised authentication responses fail clearly', async () => {
  const missing = createAuthorization({ baseUrl: config.baseUrl }, () => assert.fail('Must not contact upstream'));
  await assert.rejects(missing.post('/MemberAccount/RequestOTP', {}), /Configure LOYALTY_USERNAME/);
  const bad = createAuthorization(config, async () => json({ message: 'Invalid account' }));
  await assert.rejects(bad.post('/MemberAccount/RequestOTP', {}), /Token response format/);
});

test('non-401 errors do not resend OTP', async () => {
  let calls = 0;
  const auth = createAuthorization({ ...config, token: tokenA }, async () => { calls++; return json({}, 500); });
  assert.equal((await auth.post('/MemberAccount/RequestOTP', {})).status, 500);
  assert.equal(calls, 1);
});

test('expired JWT is refreshed before the next request', async () => {
  let logins = 0;
  const expired = `header.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.signature`;
  const auth = createAuthorization(config, async (url) => {
    if (String(url).includes('/JWTToken/Post')) return json({ token: ++logins === 1 ? expired : tokenB });
    return json({});
  });
  await auth.post('/MemberAccount/RequestOTP', {});
  await auth.post('/MemberAccount/RequestOTP', {});
  assert.equal(logins, 2);
});

test('gateway restricts routes and hides OTP and token fields', async (t) => {
  let calls = 0;
  const gateway = createGateway({ ...config, token: tokenA }, async () => {
    calls++;
    return json({ OTP: '123456', Token: tokenA, FirstLogin: 'true', nested: { otpCode: '123456' } });
  });
  await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => gateway.close(resolve)));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
  assert.equal((await fetch(`${base}/api/JWTToken/Post`, options)).status, 404);
  assert.equal((await fetch(`${base}/api/MemberDetails/GetMemberDetails`, options)).status, 401);
  assert.equal((await fetch(`${base}/api/MemberAccount/RequestOTP`)).status, 405);
  assert.equal((await fetch(`${base}/api/MemberAccount/RequestOTP`, { ...options, body: 'invalid' })).status, 400);
  const response = await fetch(`${base}/api/MemberAccount/RequestOTP`, options);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { FirstLogin: 'true', nested: {} });
  assert.equal(calls, 1);
});
