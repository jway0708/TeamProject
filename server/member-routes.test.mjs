import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './index.mjs';
test('shortcut routes forward GET catalogues and session-bound member records', async t => {
 const calls=[];
 const server=createGateway({baseUrl:'https://example.test/api',token:'test-token-aaaaaaaaaaaaaaaaaaaa'},async(url,options)=>{
  calls.push({url,method:options.method,body:options.body?JSON.parse(options.body):null});
  if(url.endsWith('/MemberMobileLoginGetProfile'))return Response.json({success:true});
  if(url.endsWith('/GetMemberDetails'))return Response.json({PhoneNumber:'0123456789',ReferralCode:'MYCODE'});
  return Response.json([{Id:1}]);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 for(const path of ['/MemberVoucher/GetAllVoucher','/ManageOutlets/GetAllOutlets']) {
  assert.equal((await fetch(base+path)).status,200);assert.equal(calls.at(-1).method,'GET');
 }
 const paths=['/MemberAccount/GetMemberStampList','/MemberAccount/GetMemberStampUsedRecord','/MemberAccount/GetMemberReward','/MemberVoucher/GetVoucherByPhone','/MemberWallet/MemberGetWalletDetails','/History/GetTopUpRecordByPhoneNumber'];
 for(const path of paths)assert.equal((await post(path,{})).status,401);
 const login=await post('/MemberLogin/MemberMobileLoginGetProfile',{Phone:'0123456789',OTP:'123456'});
 const cookie=login.headers.get('set-cookie');
 for(const path of paths){
  assert.equal((await post(path,{PhoneNumber:'999'},cookie)).status,403);
  assert.equal((await post(path,{},cookie)).status,200);
  assert.deepEqual(calls.at(-1).body,{PhoneNumber:'0123456789'});
 }
 assert.equal((await post('/MemberAccount/GetMemberDownlineList',{ReferralCode:'OTHER'},cookie)).status,200);
 assert.deepEqual(calls.at(-1).body,{ReferralCode:'MYCODE'});
 assert.equal((await post('/MemberVoucher/GetVoucherById',{RewardId:'r1'},cookie)).status,200);
 assert.deepEqual(calls.at(-1).body,{PhoneNumber:'0123456789',RewardId:'r1'});
 for (const path of ['/MemberAccount/MemberEditProfile', '/MemberAccount/GenerateMailOTP']) {
  assert.equal((await post(path, {})).status, 401);
  assert.equal((await post(path, {PhoneNumber:'999'},cookie)).status, 403);
 }
 assert.equal((await post('/MemberAccount/MemberEditProfile',{UserName:' Matt ',Email:' matt@example.test ',Extra:'ignored'},cookie)).status,200);
 assert.deepEqual(calls.at(-1).body,{PhoneNumber:'0123456789',UserName:'Matt',Email:'matt@example.test',Birthday:null,ImageByte:null});
 assert.equal((await post('/MemberAccount/GenerateMailOTP',{DeviceId:'device',Extra:'ignored'},cookie)).status,200);
 assert.deepEqual(calls.at(-1).body,{PhoneNumber:'0123456789',DeviceId:'device'});
});
