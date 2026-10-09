import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './index.mjs';
import { additionalReadRoutes, additionalWriteRoutes } from './member-operations.mjs';

test('new member operations bind identity, verify record ownership, and revoke logout sessions', async t => {
  const calls = [];
  const phone = '+60123456789';
  const server = createGateway({ baseUrl: 'https://example.test/api', token: 'test-token-aaaaaaaaaaaaaaaaaaaa' }, async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, body });
    if (url.endsWith('/MemberMobileLoginGetProfile')) return Response.json({ success: true });
    if (url.endsWith('/GetMemberDetails')) return Response.json({ PhoneNumber: phone, UserId: 'user-1', BirthDate: '2000-01-01', ImageByte: 'aW1hZ2U=', Password: 'secret', DeviceId: 'secret' });
    if (url.endsWith('/GetNotificationsFilterMember')) return Response.json([{ NotificationId: 'notification-1', Content: 'Welcome' }]);
    if (url.endsWith('/GetTopUpRecordByPhoneNumber')) return Response.json([{ TopupId: 'topup-1' }]);
    return Response.json({ success: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path, body = {}, cookie) => fetch(base + path.replace(/^\/api/, ''), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  for (const path of [...additionalReadRoutes, ...additionalWriteRoutes]) {
    assert.equal((await post(path)).status, 401, path);
  }
  const login = await post('/MemberLogin/MemberMobileLoginGetProfile', { Phone: phone, OTP: '123456' });
  const cookie = login.headers.get('set-cookie');
  const profile = await (await post('/MemberDetails/GetMemberDetails', {}, cookie)).json();
  assert.equal(profile.UserId, 'user-1');
  assert.equal(profile.BirthDate, '2000-01-01');
  assert.equal(profile.ImageByte, 'aW1hZ2U=');
  assert.equal(profile.Password, undefined);
  assert.equal(profile.DeviceId, undefined);
  for (const path of additionalReadRoutes.filter(path => /\/History\/|GetSpendRecords|GetMemberVoucherHistories/.test(path))) {
    assert.equal((await post(path, { PhoneNumber: 'other' }, cookie)).status, 403);
    assert.equal((await post(path, {}, cookie)).status, 200);
    assert.deepEqual(calls.at(-1).body, { PhoneNumber: phone });
  }
  assert.equal((await post('/MemberNotification/GetNotificationsDetails', { Notification_Id: 'other' }, cookie)).status, 403);
  assert.equal((await post('/MemberNotification/GetNotificationsDetails', { Notification_Id: 'notification-1' }, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { Notification_Id: 'notification-1' });
  assert.equal((await post('/MemberNotification/UserReadNotification', { NotificationId: 'other' }, cookie)).status, 403);
  assert.equal((await post('/MemberNotification/UserReadNotification', { NotificationId: 'notification-1' }, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { PhoneNumber: phone, NotificationId: 'notification-1' });
  assert.equal((await post('/MemberNotification/UserReadAllNotification', {}, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { PhoneNumber: phone });
  assert.equal((await post('/MemberAccount/GetTopUpRecordDetails', { TopupId: 'other' }, cookie)).status, 403);
  assert.equal((await post('/MemberAccount/GetTopUpRecordDetails', { TopupId: 'topup-1' }, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { TopupId: 'topup-1' });
  assert.equal((await post('/FeedBack/GetFeedbackListFilterUser', { UserId: 'other' }, cookie)).status, 403);
  assert.equal((await post('/FeedBack/GetFeedbackListFilterUser', {}, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { UserId: 'user-1' });
  assert.equal((await post('/FeedBack/CreateFeedback', { Title: 'Test', Description: 'Test', Rating: '9' }, cookie)).status, 400);
  assert.equal((await post('/FeedBack/CreateFeedback', { Title: 'Test', Description: 'Test', Rating: '5', Extra: 'ignored' }, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { UserId: 'user-1', Title: 'Test', Description: 'Test', Rating: '5', Category: '', Location: '' });
  assert.equal((await post('/MemberLogin/UpdateDeviceId', { DeviceId: 'device-1' }, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { PhoneNumber: phone, DeviceId: 'device-1' });
  assert.equal((await post('/MemberAccount/UpdateAccountStatusDeactive', { PhoneNumber: 'other' }, cookie)).status, 403);
  assert.equal((await post('/MemberAccount/UpdateAccountStatusDeactive', {}, cookie)).status, 200);
  assert.deepEqual(calls.at(-1).body, { PhoneNumber: phone });
  assert.equal((await post('/MemberAccount/KeepLoginUser', {}, cookie)).status, 200);
  assert.equal((await post('/MemberLogin/Logout', {}, cookie)).status, 200);
  assert.equal((await post('/MemberAccount/KeepLoginUser', {}, cookie)).status, 401);
});
