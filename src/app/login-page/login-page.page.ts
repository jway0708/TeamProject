import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.page.html',
  styleUrls: ['./login-page.page.scss'],
  standalone: false,
})
export class LoginPage {
  phoneNumber: string = '';
  otpCode: string = '';
  referralCode: string = '';
  isRegister: boolean = false;
  countdown: number = 0;
  private timer: any;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  resetForm() {
    this.otpCode = '';
    this.referralCode = '';
  }

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

  // 2. 发送 OTP 验证码
  async onSendOtp() {
    if (!this.phoneNumber) {
      this.showToast('Please enter your phone number first.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Sending OTP...' });
    await loading.present();

    this.apiService.requestOtp(this.phoneNumber, this.isRegister).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.showToast('OTP sent successfully!');
        this.startCountdown();
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Failed to send OTP: ' + (err.error?.message || 'Please try again.'));
      }
    });
  }

  startCountdown() {
    this.countdown = 60;
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.timer);
      }
    }, 1000);
  }

  // 3. 提交登录或注册
  async onSubmit() {
    const loading = await this.loadingCtrl.create({ message: 'Processing...' });
    await loading.present();

    this.apiService.loginOrRegister(
      this.phoneNumber,
      this.otpCode,
      this.referralCode,
      this.isRegister
    ).subscribe({
      next: async (res) => {
        await loading.dismiss();
        // 保存当前用户手机号到本地存储
        localStorage.setItem('user_phone', this.phoneNumber);
        
        this.showToast('Operation successful!');
        // 跳转至首页
        this.router.navigateByUrl('/home');
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Verification failed: ' + (err.error?.message || 'Invalid OTP.'));
      }
    });
  }

  private async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}