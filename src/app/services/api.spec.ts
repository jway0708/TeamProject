import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService, nativeHttp } from './api';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService); http = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('uses RequestOTP for login and RegisterOtp for signup', () => {
    api.requestOtp('012345', false).subscribe();
    const login = http.expectOne('/api/MemberAccount/RequestOTP');
    expect(login.request.body.PhoneNumber).toBe('012345'); login.flush('{}');
    api.requestOtp('012345', true).subscribe();
    http.expectOne('/api/MemberAccount/RegisterOtp').flush('{}');
  });
  it('rejects HTTP 200 containing the remote server error', () => {
    let message = '';
    api.requestOtp('012345', false).subscribe({ error: error => message = error.message });
    http.expectOne('/api/MemberAccount/RequestOTP').flush('The remote server returned an error: (400) Bad Request.');
    expect(message).toContain('400');
  });
  it('uses Swagger OTP login fields and rejects an unconfirmed result', () => {
    let failed = false;
    api.loginOrRegister('012345', '987654').subscribe({ error: () => failed = true });
    const request = http.expectOne('/api/MemberLogin/MemberMobileLoginGetProfile');
    expect(request.request.body.Phone).toBe('012345');
    expect(request.request.body.OTP).toBe('987654');
    request.flush('{"success":false}');
    expect(failed).toBe(true);
  });
  it('does not register a new account if OTP verification fails', () => {
    api.loginOrRegister('012345', '987654', 'REF', true).subscribe({ error: () => undefined });
    http.expectOne('/api/MemberLogin/MemberMobileLoginGetProfile').flush('{"success":false}');
    http.expectNone('/api/MemberLogin/RegisterMember');
  });
  it('uses the emulator backend and forwards its member session on native requests', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const nativeApi = new ApiService(TestBed.inject(HttpClient));
    const request = vi.spyOn(nativeHttp, 'request')
      .mockResolvedValueOnce({ status: 200, headers: { 'Set-Cookie': 'member_session=test-session; HttpOnly; Path=/api' }, data: '{"PhoneNumber":"012345"}', url: '' })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: '{"PhoneNumber":"012345"}', url: '' });
    await firstValueFrom(nativeApi.loginWithEmail('member@example.test', 'test-password'));
    await firstValueFrom(nativeApi.getMemberDetails('012345'));
    expect(request.mock.calls[0][0].url).toBe('http://10.0.2.2:3000/api/MemberLogin/CheckEmailPassword');
    expect(request.mock.calls[1][0].headers?.['Cookie']).toBe('member_session=test-session');
    expect(request.mock.calls[0][0].headers?.['Authorization']).toBeUndefined();
  });
  it('always sends a phone-number OTP to the backend for verification when no demo OTP was requested', () => {
    api.loginOrRegister('+60123456789', '+60123456789').subscribe({ error: () => undefined });
    const request = http.expectOne('/api/MemberLogin/MemberMobileLoginGetProfile');
    expect(request.request.body.OTP).toBe('+60123456789');
    request.flush('{"success":false}');
    api.getMemberDetails('+60123456789').subscribe();
    http.expectOne('/api/MemberDetails/GetMemberDetails').flush('{}');
  });
  it('uses phone-number login without SMS and then reads real member details', async () => {
    await firstValueFrom(api.requestDemoOtp('+60123456789'));
    await expect(firstValueFrom(api.loginOrRegister('+60123456789', '123456'))).rejects.toThrow('same phone number');
    const login = firstValueFrom(api.loginOrRegister('+60123456789', '60123456789'));
    const request = http.expectOne('/api/MemberLogin/PhoneNumberLogin');
    expect(request.request.body).toEqual({ PhoneNumber: '+60123456789', OTP: '60123456789' });
    request.flush('{"success":true}'); await login;
    const profile = firstValueFrom(api.getMemberDetails('+60123456789'));
    http.expectOne('/api/MemberDetails/GetMemberDetails').flush('{"Name":"Actual Member","PhoneNumber":"+60123456789","Point":200}');
    expect(await profile).toEqual({ Name: 'Actual Member', PhoneNumber: '+60123456789', Point: 200 });
    http.expectNone('/api/MemberAccount/RequestOTP');
    http.expectNone('/api/MemberLogin/MemberMobileLoginGetProfile');
  });
  it('verifies signup OTP before submitting the phone and referral code', async () => {
    const registration = firstValueFrom(api.loginOrRegister('+60123456789', '012345', 'MYREF', true));
    const verification = http.expectOne('/api/MemberLogin/MemberMobileLoginGetProfile');
    expect(verification.request.body.FirstLogin).toBe(true);
    expect(verification.request.body.OTP).toBe('012345');
    http.expectNone('/api/MemberLogin/RegisterMember');
    verification.flush('{"success":true}');
    const request = http.expectOne('/api/MemberLogin/RegisterMember');
    expect(request.request.body).toEqual({ PhoneNumber: '+60123456789', ReferralBy: 'MYREF' });
    request.flush('{"success":true}');
    expect(await registration).toEqual({ success: true });
  });
  it('uses local phone OTP for signup without calling SMS verification', async () => {
    await firstValueFrom(api.requestDemoOtp('+60123456789'));
    await expect(firstValueFrom(api.loginOrRegister('+60123456789', 'wrong', 'REF', true))).rejects.toThrow('same phone number');
    const result = firstValueFrom(api.loginOrRegister('+60123456789', '+60123456789', 'REF', true));
    const request = http.expectOne('/api/MemberLogin/PhoneNumberRegister');
    expect(request.request.body).toEqual({ PhoneNumber: '+60123456789', OTP: '+60123456789', ReferralBy: 'REF' });
    request.flush('{"success":true}'); await result;
    http.expectNone('/api/MemberAccount/RegisterOtp');
    http.expectNone('/api/MemberLogin/MemberMobileLoginGetProfile');
  });
});
