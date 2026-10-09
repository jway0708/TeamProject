import { LoginPage } from './login-page.page';
import { ApiService } from '../services/api';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { MemberSession } from '../services/member-session';
import { AndroidMember } from '../services/android-member';
import { of } from 'rxjs';

describe('LoginPage', () => {
  it('submits a real SMS OTP rather than comparing it with the phone number', async () => {
    const loginOrRegister = vi.fn(() => of({ success: true }));
    const page = new LoginPage({ demoOtpEnabled: false, requestOtp: () => of({ success: true }), loginOrRegister } as unknown as ApiService,
      { navigateByUrl: vi.fn() } as unknown as Router,
      { create: async () => ({ present: async () => undefined }) } as unknown as ToastController,
      { create: async () => ({ present: async () => undefined, dismiss: async () => undefined }) } as unknown as LoadingController,
      { establish: vi.fn(async () => undefined) } as unknown as MemberSession,
      { registerPush: vi.fn() } as unknown as AndroidMember);
    page.phoneNumber = '+60123456789';
    page.otpCode = '123456';
    await page.onSendOtp();
    await page.onSubmit();
    expect(loginOrRegister).toHaveBeenCalledWith('+60123456789', '123456', undefined, false);
    page.ngOnDestroy();
  });
  it('does not submit a phone login until an OTP was requested', async () => {
    let submitted = false;
    const page = new LoginPage({ loginOrRegister: () => { submitted = true; } } as unknown as ApiService,
      {} as Router, { create: async () => ({ present: async () => undefined }) } as unknown as ToastController,
      {} as LoadingController, {} as MemberSession, {} as AndroidMember);
    page.phoneNumber = '012345'; page.otpCode = '987654';
    await page.onSubmit();
    expect(submitted).toBe(false);
  });
});
