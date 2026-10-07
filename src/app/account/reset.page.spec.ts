import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiService } from '../services/api';
import { ResetPage } from './reset.page';

describe('ResetPage SMS verification', () => {
  it('requires a requested OTP and only resets after backend verification succeeds', async () => {
    const api = { requestOtp: vi.fn(() => of({ success: true })), verifyOtp: vi.fn(() => of({ success: true })), post: vi.fn(() => of({ success: true })) };
    const page = new ResetPage(api as unknown as ApiService, { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    try {
      page.phone = '+60123456789'; page.password = page.confirm = 'test-password';
      await page.reset();
      expect(page.message).toContain('Request an OTP');
      await page.send();
      expect(api.requestOtp).toHaveBeenCalledWith(page.phone, false);
      api.verifyOtp.mockReturnValueOnce(throwError(() => new Error('Invalid OTP')));
      page.otp = page.phone;
      await page.reset();
      expect(page.message).toBe('Invalid OTP');
      expect(api.post).not.toHaveBeenCalled();
      page.otp = '012345';
      await page.reset();
      expect(api.verifyOtp).toHaveBeenLastCalledWith('+60123456789', '012345');
      expect(api.post).toHaveBeenCalledWith('/MemberAccount/MemberResetPassword', { PhoneNumber: '+60123456789', NewPassword: 'test-password' });
      expect(page.password).toBe('');
      await page.reset();
      expect(page.message).toContain('Request an OTP');
    } finally { page.ngOnDestroy(); }
  });
  it('does not verify a code when sending SMS fails', async () => {
    const api = { requestOtp: vi.fn(() => throwError(() => new Error('SMS unavailable'))), verifyOtp: vi.fn(), post: vi.fn() };
    const page = new ResetPage(api as unknown as ApiService, { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    page.phone = '+60123456789';
    await page.send();
    expect(page.message).toBe('SMS unavailable');
    await page.reset();
    expect(api.verifyOtp).not.toHaveBeenCalled();
  });
});
  
// Phone-number OTP follows the same local flow as login.
describe('ResetPage phone-number OTP', () => {
  it('does not send SMS and resets only after the matching phone passes the local login', async () => {
    const api = { demoOtpEnabled: true, requestDemoOtp: vi.fn(() => of({ success: true })), requestOtp: vi.fn(), verifyOtp: vi.fn(), loginOrRegister: vi.fn(() => of({ success: true })), post: vi.fn(() => of({ success: true })) };
    const page = new ResetPage(api as unknown as ApiService, { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    try {
      page.phone = '+60123456789'; page.password = page.confirm = 'new-password';
      await page.send(); expect(page.message).toBe('SMS sent');
      expect(api.requestOtp).not.toHaveBeenCalled();
      page.otp = '123456'; await page.reset();
      expect(page.message).toContain('The OTP is incorrect.'); expect(page.otp).toBe('123456');
      expect(api.post).not.toHaveBeenCalled();
      page.otp = '+60 123-456789'; await page.reset();
      expect(api.loginOrRegister).toHaveBeenCalledWith(page.phone, '60123456789');
      expect(api.verifyOtp).not.toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledWith('/MemberAccount/MemberResetPassword', { PhoneNumber: page.phone, NewPassword: 'new-password', OTP: '60123456789' });
      expect(page.success).toBe(true); expect(page.password).toBe('');
    } finally { page.ngOnDestroy(); }
  });
});
