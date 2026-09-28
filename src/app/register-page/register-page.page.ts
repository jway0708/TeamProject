import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-register-page',
  templateUrl: './register-page.page.html',
  styleUrls: ['./register-page.page.scss'],
  standalone: false,
})
export class RegisterPagePage {
  phoneNumber: string = '';
  otpCode: string = '';
  referralCode: string = '';
  countdown: number = 0;
  private timer: any;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

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
    if (!this.phoneNumber) {
      this.showToast('Please enter your phone number first.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Sending OTP...' });
    await loading.present();

    // isRegister 参数传 true
    this.apiService.requestOtp(this.phoneNumber, true).subscribe({
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

  // 3. 提交注册
  async onSubmit() {
    const loading = await this.loadingCtrl.create({ message: 'Registering...' });
    await loading.present();

    // isRegister 参数传 true
    this.apiService.loginOrRegister(
      this.phoneNumber,
      this.otpCode,
      this.referralCode,
      true
    ).subscribe({
      next: async (res) => {
        await loading.dismiss();
        localStorage.setItem('user_phone', this.phoneNumber);
        
        this.showToast('Registration successful!');
        this.router.navigateByUrl('/home');
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('Registration failed: ' + (err.error?.message || 'Invalid OTP.'));
      }
    });
  }

  // 跳转回登录页
  goToLogin() {
    this.router.navigateByUrl('/login-page');
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