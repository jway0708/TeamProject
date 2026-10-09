import { RegisterPagePage, registrationErrorMessage } from './register-page.page';
import { of } from 'rxjs';
import { ApiService } from '../services/api';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';

describe('RegisterPagePage', () => {
  it('shows backend validation messages from text HTTP error responses', () => {
    expect(registrationErrorMessage({ error: '{"Message":"Phone already registered"}', message: '400 Bad Request' })).toBe('Phone already registered');
    expect(registrationErrorMessage({ error: '"Invalid referral code"' })).toBe('Invalid referral code');
  });

  it('blocks invalid referral codes and trims valid codes before registering', async () => {
    const loginOrRegister = vi.fn(() => of({ success: true }));
    const checkReferralCode = vi.fn(() => of('Referral Code Not Exist'));
    const page = new RegisterPagePage({ demoOtpEnabled: true, requestDemoOtp: () => of({ success: true }), checkReferralCode, loginOrRegister } as unknown as ApiService,
      { navigateByUrl: vi.fn() } as unknown as Router,
      { create: async () => ({ present: async () => undefined }) } as unknown as ToastController,
      { create: async () => ({ present: async () => undefined, dismiss: async () => undefined }) } as unknown as LoadingController);
    page.phoneNumber = '+60123456789'; page.otpCode = page.phoneNumber; page.referralCode = ' MWODJ ';
    page.name = 'Test Member'; page.email = 'member@example.test';
    page.password = 'test-password';
    await page.onSendOtp();
    try {
      await page.onSubmit();
      expect(loginOrRegister).not.toHaveBeenCalled();
      checkReferralCode.mockReturnValue(of('Referral Code Exist'));
      await page.onSubmit();
      expect(checkReferralCode).toHaveBeenCalledWith('MWODJ');
      expect(loginOrRegister).toHaveBeenCalledWith(page.phoneNumber, page.otpCode, 'MWODJ', true, { Name: 'Test Member', Email: 'member@example.test', EmailSubcribe: 'false', Password: 'test-password' });
    } finally { page.ngOnDestroy(); }
  });
  it('does not submit registration before an OTP request', async () => {
    let submitted = false;
    const page = new RegisterPagePage({ loginOrRegister: () => { submitted = true; } } as unknown as ApiService,
      {} as Router, { create: async () => ({ present: async () => undefined }) } as unknown as ToastController, {} as LoadingController);
    page.phoneNumber = '012345'; page.otpCode = '987654';
    await page.onSubmit(); expect(submitted).toBe(false);
  });
});
