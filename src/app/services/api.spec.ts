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
  it('test phone login uses demo data and never calls real member endpoints', async () => {
    await firstValueFrom(api.requestDemoOtp('+60123456789'));
    await expect(firstValueFrom(api.loginOrRegister('+60123456789', 'wrong'))).rejects.toThrow('same phone number');
    await firstValueFrom(api.loginOrRegister('+60123456789', '60123456789'));
    const profile = await firstValueFrom(api.getMemberDetails('+60123456789')) as { Name: string; PhoneNumber: string };
    expect(profile.Name).toBe('Test Member');
    expect(profile.PhoneNumber).toBe('+60123456789');
    await expect(firstValueFrom(api.post('/MemberWallet/Topup', {}))).rejects.toThrow('demo data');
    http.expectNone('/api/MemberAccount/RequestOTP');
    http.expectNone('/api/MemberDetails/GetMemberDetails');
  });
});
