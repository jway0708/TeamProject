import { releasePageFocus } from '../services/page-focus';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-register-page',
  templateUrl: './register-page.page.html',
  styleUrls: ['./register-page.page.scss'],
  standalone: false,
})
export class RegisterPagePage implements OnDestroy {
  readonly phoneOtpEnabled = this.apiService.demoOtpEnabled;
  phoneNumber: string = '';
  otpCode: string = '';
  referralCode: string = '';
  countdown: number = 0;
  private otpRequestedFor: string | null = null;
  private timer: any;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private cdr?: ChangeDetectorRef
  ) { }

  // 1. 失去焦点时校验推荐码
  onCheckReferral() {
    if (!this.referralCode.trim()) return;
    this.apiService.checkReferralCode(this.referralCode).subscribe({
      next: (res) => {
        if (!res.isValid) {
          this.showToast('Invalid referral code, please try again.');
        }
      },
      error: () => this.showToast('Error validating referral code.')
    });
  }

  // 2. 发送注册 OTP 验证码
  async onSendOtp() {
    const phone = this.phoneNumber.trim();
    if (!phone) {
      this.showToast('Please enter your phone number first.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Sending OTP...' });
    await loading.present();

    // isRegister 参数传 true
    (this.phoneOtpEnabled ? this.apiService.requestDemoOtp(phone) : this.apiService.requestOtp(phone, true)).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.otpRequestedFor = phone;
        this.showToast('SMS sent');
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

  // 3. 提交注册
  async onSubmit() {
    const phone = this.phoneNumber.trim();

    if (!this.otpRequestedFor || this.otpRequestedFor !== phone) {
      this.showToast('Please request an OTP for this phone number first.');
      return;
    }

    if (this.phoneOtpEnabled && this.otpCode.trim() !== phone) {
      await this.showToast('The OTP is incorrect.'); this.otpCode = ''; return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Registering...' });
    await loading.present();

    // isRegister 参数传 true
    this.apiService.loginOrRegister(
      phone,
      this.otpCode,
      this.referralCode,
      true
    ).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.showToast('Registration submitted. Please sign in with an OTP to load your profile.');
        this.router.navigateByUrl('/login-page');
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Registration failed: ' + (err.error?.message || err.message || 'Invalid OTP.'));
      }
    });
  }

  // 跳转回登录页
  goToLogin() {
    this.router.navigateByUrl('/login-page');
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
