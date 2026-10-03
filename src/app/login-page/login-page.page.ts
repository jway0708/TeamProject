import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api';
import { MemberSession } from '../services/member-session';
import { AndroidMember } from '../services/android-member';
import { field } from '../services/api-response';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.page.html',
  styleUrls: ['./login-page.page.scss'],
  standalone: false,
})
export class LoginPage implements OnDestroy {
  emailMode = false;
  email = '';
  password = '';
  phoneNumber: string = '';
  otpCode: string = '';
  countdown: number = 0;
  private otpRequestedFor: string | null = null;
  private timer: any;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private session: MemberSession,
    private android: AndroidMember,
  ) {}

  // 2. 发送 OTP 验证码
  async onSendOtp() {
    const phone = this.phoneNumber.trim();
    if (!phone) {
      this.showToast('Please enter your phone number first.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Sending OTP...' });
    await loading.present();

    this.apiService.requestOtp(phone, false).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.otpRequestedFor = phone;
        this.showToast('OTP sent successfully!');
        this.startCountdown();
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Failed to send OTP: ' + (err.error?.message || err.message || 'Please try again.'));
      }
    });
  }

  startCountdown() {
    clearInterval(this.timer);
    this.countdown = 60;
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.timer);
      }
    }, 1000);
  }

  // 3. 提交登录
  async onSubmit() {
    const phone = this.phoneNumber.trim();

    if (!this.otpRequestedFor || this.otpRequestedFor !== phone) {
      this.showToast('Please request an OTP for this phone number first.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Processing...' });
    await loading.present();

    this.apiService.loginOrRegister(
      phone,
      this.otpCode,
      undefined,
      false
    ).subscribe({
      next: async (res) => {
        await loading.dismiss();
        // 保存当前用户手机号到本地存储
        try {
          await this.session.establish(phone);
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Unable to load your profile.');
          return;
        }
        void this.android.registerPush(phone);
        
        this.showToast('Operation successful!');
        // 跳转至首页
        this.router.navigateByUrl('/tabs/homepage');
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Verification failed: ' + (err.error?.message || err.message || 'Invalid OTP.'));
      }
    });
  }

  async emailLogin() {
    if (!this.email.trim() || !this.password) return;
    const loading = await this.loadingCtrl.create({ message: 'Signing in...' });
    await loading.present();
    try {
      const response = await firstValueFrom(this.apiService.loginWithEmail(this.email.trim(), this.password));
      const data = field(response, 'Data') || response;
      const phone = field(data, 'PhoneNumber', 'Phone');
      if (typeof phone !== 'string' || !phone.trim()) throw new Error('The login response does not include your phone number.');
      await this.session.establish(phone);
      this.password = '';
      void this.android.registerPush(phone);
      await this.router.navigateByUrl('/tabs/homepage');
    } catch (error) { this.showToast(error instanceof Error ? error.message : 'Unable to sign in.'); }
    finally { await loading.dismiss(); }
  }
  ngOnDestroy() { clearInterval(this.timer); }

  private async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
