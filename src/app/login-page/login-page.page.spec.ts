import { LoginPage } from './login-page.page';
import { ApiService } from '../services/api';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { MemberSession } from '../services/member-session';
import { AndroidMember } from '../services/android-member';

describe('LoginPage', () => {
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
