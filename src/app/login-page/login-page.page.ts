import { releasePageFocus } from '../services/page-focus';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  readonly demoOtpEnabled = this.apiService.demoOtpEnabled;
  email = '';
  password = '';
  showPassword = false;
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
    private cdr?: ChangeDetectorRef,
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

    (this.demoOtpEnabled ? this.apiService.requestDemoOtp(phone) : this.apiService.requestOtp(phone, false)).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.otpRequestedFor = phone;
        this.showToast(this.demoOtpEnabled ? 'For this local test, enter your complete phone number as OTP.' : 'SMS sent');
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
      this.cdr?.markForCheck();
      if (this.countdown <= 0) {
        clearInterval(this.timer);
      }
    }, 1000);
  }

  // 3. 提交登录
  async onSubmit() {
    const phone = this.phoneNumber.trim();

    // Demo OTP：按照老师的要求，OTP 等于完整电话号码。
    if (this.demoOtpEnabled && this.otpCode.replace(/[\s()+-]/g, '') !== phone.replace(/[\s()+-]/g, '')) {
      await this.showToast('The OTP is incorrect.');
      this.otpCode = '';
      return;
    }

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
        if (!this.demoOtpEnabled) void this.android.registerPush(phone);
        
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
    finally { await loading.dismiss(); this.cdr?.markForCheck(); }
  }
  ionViewWillLeave() { releasePageFocus(); }
  ngOnDestroy() { clearInterval(this.timer); }

  private async showToast(msg: string) {
    this.cdr?.markForCheck();
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
