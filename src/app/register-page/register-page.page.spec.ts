import { RegisterPagePage } from './register-page.page';
import { ApiService } from '../services/api';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';

describe('RegisterPagePage', () => {
  it('does not submit registration before an OTP request', async () => {
    let submitted = false;
    const page = new RegisterPagePage({ loginOrRegister: () => { submitted = true; } } as unknown as ApiService,
      {} as Router, { create: async () => ({ present: async () => undefined }) } as unknown as ToastController, {} as LoadingController);
    page.phoneNumber = '012345'; page.otpCode = '987654';
    await page.onSubmit(); expect(submitted).toBe(false);
  });
});
