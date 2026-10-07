import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './index.mjs';
test('registration preserves referral code and does not authenticate the new account', async t => {
  let payload;
  const server = createGateway({baseUrl:'https://example.test/api',token:'test-token-aaaaaaaaaaaaaaaaaaaa'},async (url,options) => {
    assert.ok(url.endsWith('/RegisterMember')); payload=JSON.parse(options.body); return Response.json({success:true});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const response=await post('/MemberLogin/RegisterMember',{PhoneNumber:'+60123456789',ReferralBy:'MYREF'});
  assert.equal(response.status,200);
  assert.deepEqual(payload,{PhoneNumber:'+60123456789',ReferralBy:'MYREF'});
  assert.equal((await post('/MemberDetails/GetMemberDetails',{},response.headers.get('set-cookie'))).status,401);
});
