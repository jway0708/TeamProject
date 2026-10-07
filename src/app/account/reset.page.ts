import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { releasePageFocus } from '../services/page-focus';
import { ApiService } from '../services/api';

@Component({
  standalone: true, imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  templateUrl: './reset.page.html', styleUrls: ['./reset.page.scss'] })
export class ResetPage implements OnDestroy {
  phone = ''; otp = ''; password = ''; confirm = ''; message = ''; busy = false; countdown = 0;
  readonly phoneOtpEnabled = this.api.demoOtpEnabled;
  success = false;
  showPassword = false;
  showConfirm = false;
  private cleanPhone(value: string): string { return value.normalize('NFKC').replace(/[\s()+\-\u200B-\u200D\uFEFF]/g, ''); }
  private requestedPhone = '';
  private timer?: ReturnType<typeof setInterval>;
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) { }
  async send() {
    if (!this.phone.trim() || this.busy || this.countdown) return;
    this.busy = true; this.success = false;
    try {
      await firstValueFrom(this.phoneOtpEnabled ? this.api.requestDemoOtp(this.phone.trim()) : this.api.requestOtp(this.phone.trim(), false));
      this.requestedPhone = this.phone.trim(); this.message = 'SMS sent';
      this.countdown = 60;
      clearInterval(this.timer);
      this.timer = setInterval(() => { if (--this.countdown <= 0) clearInterval(this.timer); this.cdr.markForCheck(); }, 1000);
    } catch (error) { this.message = this.errorMessage(error, 'OTP request failed.'); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async reset() {
    if (this.busy) return;
    if (this.cleanPhone(this.phone) !== this.cleanPhone(this.requestedPhone) || !this.requestedPhone) { this.message = 'Request an OTP for this phone first.'; return; }
    if (this.phoneOtpEnabled && this.cleanPhone(this.otp) !== this.cleanPhone(this.phone)) { this.message = 'The OTP is incorrect. Enter the complete phone number.'; return; }
    if (this.password.length < 6) { this.message = 'Use at least 6 characters for your password.'; return; }
    if (!this.password || this.password !== this.confirm) { this.message = 'Passwords must match.'; return; }
    this.busy = true;
    try {
      await firstValueFrom(this.phoneOtpEnabled ? this.api.loginOrRegister(this.phone.trim(), this.cleanPhone(this.otp)) : this.api.verifyOtp(this.phone.trim(), this.otp));
      await firstValueFrom(this.api.post('/MemberAccount/MemberResetPassword', { PhoneNumber: this.phone.trim(), NewPassword: this.password, ...(this.phoneOtpEnabled ? { OTP: this.cleanPhone(this.otp) } : {}) }));
      this.password = ''; this.confirm = ''; this.otp = ''; this.requestedPhone = '';
      clearInterval(this.timer); this.countdown = 0;
      this.showPassword = false; this.showConfirm = false;
      this.success = true;
      this.message = 'Password reset. You can now sign in.';
    } catch (error) { this.message = this.errorMessage(error, 'Password reset failed.'); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  ionViewWillLeave() { releasePageFocus(); }
  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) return error.error?.message || fallback;
    return error instanceof Error ? error.message : fallback;
  }
  ngOnDestroy() { clearInterval(this.timer); }
}
