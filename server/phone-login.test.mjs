import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './index.mjs';
async function setup(t, enabled, handler) {
  const server = createGateway({ baseUrl: 'https://example.test/api', token: 'test-token-aaaaaaaaaaaaaaaaaaaa', allowPhoneNumberLogin: enabled }, handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, body, cookie) => fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}
const route = 'MemberLogin/PhoneNumberLogin';
const phone = '+60123456789';
test('local phone login gets a real profile without requesting SMS and creates a read session', async t => {
  let calls = 0;
  const post = await setup(t, true, async (url, options) => {
    calls++; assert.ok(url.endsWith('/MemberDetails/GetMemberDetails'));
    assert.deepEqual(JSON.parse(options.body), { PhoneNumber: phone });
    return Response.json({ Name: 'Real Member', PhoneNumber: phone, Point: 220, Password: 'secret' });
  });
  assert.equal((await post(route, { PhoneNumber: phone, OTP: 'wrong' })).status, 400);
  assert.equal(calls, 0);
  const login = await post(route, { PhoneNumber: phone, OTP: '60123456789' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  const response = await post('MemberDetails/GetMemberDetails', { PhoneNumber: phone }, cookie);
  const profile = await response.json();
  assert.equal(profile.Name, 'Real Member'); assert.equal(profile.Point, 220); assert.equal(profile.Password, undefined);
  assert.equal((await post('MemberAccount/MemberResetPassword', { NewPassword: 'new-password' }, cookie)).status, 403);
  assert.equal(calls, 2);
});
test('phone login is disabled by default', async t => {
  const post = await setup(t, false, () => { throw new Error('Unexpected upstream request'); });
  assert.equal((await post(route, { PhoneNumber: phone, OTP: phone })).status, 403);
});
test('mismatched or failed real profiles cannot create a phone session', async t => {
  const post = await setup(t, true, async () => Response.json({ PhoneNumber: '999', Name: 'Other Member' }));
  const login = await post(route, { PhoneNumber: phone, OTP: phone });
  assert.equal(login.status, 502);
  assert.equal((await post('MemberDetails/GetMemberDetails', {}, login.headers.get('set-cookie'))).status, 401);
});

test('local password reset accepts phone OTP only for the matching local session', async t => {
  let resetCalls = 0;
  const post = await setup(t, true, async (url, options) => {
    if (url.endsWith('/GetMemberDetails')) return Response.json({ PhoneNumber: phone });
    resetCalls++;
    assert.ok(url.endsWith('/MemberResetPassword'));
    assert.deepEqual(JSON.parse(options.body), { PhoneNumber: phone, NewPassword: 'new-password' });
    return Response.json({ success: true });
  });
  const login = await post(route, { PhoneNumber: phone, OTP: phone });
  const cookie = login.headers.get('set-cookie');
  const reset = 'MemberAccount/MemberResetPassword';
  assert.equal((await post(reset, { PhoneNumber: phone, OTP: 'wrong', NewPassword: 'new-password' }, cookie)).status, 403);
  assert.equal((await post(reset, { PhoneNumber: '999', OTP: phone, NewPassword: 'new-password' }, cookie)).status, 403);
  assert.equal(resetCalls, 0);
  assert.equal((await post(reset, { PhoneNumber: phone, OTP: phone, NewPassword: 'new-password' }, cookie)).status, 200);
  assert.equal(resetCalls, 1);
});

test('local registration checks phone OTP, skips SMS and forwards real registration', async t => {
 let calls=0;
 const post=await setup(t,true,async(url,options)=>{
   calls++;assert.ok(url.endsWith('/RegisterMember'));
   assert.deepEqual(JSON.parse(options.body),{PhoneNumber:phone,ReferralBy:'REF'});
   return Response.json({success:true});
 });
 const path='MemberLogin/PhoneNumberRegister';
 assert.equal((await post(path,{PhoneNumber:phone,OTP:'wrong'})).status,400);assert.equal(calls,0);
 const response=await post(path,{PhoneNumber:phone,OTP:phone,ReferralBy:'REF'});
 assert.equal(response.status,200);assert.equal(calls,1);
 assert.equal((await post('MemberDetails/GetMemberDetails',{},response.headers.get('set-cookie'))).status,401);
});
test('local registration is disabled outside configured development mode', async t=>{
 const post=await setup(t,false,()=>{throw new Error('Unexpected request');});
 assert.equal((await post('MemberLogin/PhoneNumberRegister',{PhoneNumber:phone,OTP:phone})).status,403);
});
