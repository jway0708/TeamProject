import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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

  // 1. 失焦时校验推荐码
  onCheckReferral() {
    if (!this.referralCode.trim()) return;
    this.apiService.checkReferralCode(this.referralCode).subscribe({
      next: (res) => {
        if (!res.isValid) {
          this.showToast('推荐码无效，请重新输入');
        }
      },
      error: () => this.showToast('推荐码校验异常')
    });
  }

  // 2. 发送 OTP 验证码
  async onSendOtp() {
    if (!this.phoneNumber) {
      this.showToast('请先输入手机号码');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: '正在发送验证码...' });
    await loading.present();

    this.apiService.requestOtp(this.phoneNumber, this.isRegister).subscribe({
      next: async (res) => {
        await loading.dismiss();
        this.showToast('验证码已成功发送！');
        this.startCountdown();
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('发送验证码失败：' + (err.error?.message || '请重试'));
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

  // 3. 提交登录 / 注册
  async onSubmit() {
    const loading = await this.loadingCtrl.create({ message: '正在处理...' });
    await loading.present();

    this.apiService.loginOrRegister(
      this.phoneNumber,
      this.otpCode,
      this.referralCode,
      this.isRegister
    ).subscribe({
      next: async (res) => {
        await loading.dismiss();
        // 保存当前用户手机号到本地
        localStorage.setItem('user_phone', this.phoneNumber);
        
        this.showToast('操作成功！');
        // 跳转到首页
        this.router.navigateByUrl('/home');
      },
      error: async (err) => {
        await loading.dismiss();
        this.showToast('验证失败：' + (err.error?.message || '验证码错误'));
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