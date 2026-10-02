import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService); http = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });
  afterEach(() => http.verify());
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
});
