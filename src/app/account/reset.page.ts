import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from '../services/api';

@Component({
  standalone: true, imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  template: `<ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/login-page"></ion-back-button></ion-buttons><ion-title>Reset password</ion-title></ion-toolbar></ion-header>
  <ion-content class="ion-padding"><p role="status">{{ message }}</p>
  <form (ngSubmit)="reset()"><ion-item><ion-input label="Phone number" type="tel" [(ngModel)]="phone" name="phone" required></ion-input></ion-item>
  <ion-button type="button" (click)="send()" [disabled]="busy || countdown > 0">{{ countdown ? countdown + 's' : 'Get OTP' }}</ion-button>
  <ion-item><ion-input label="OTP" type="text" inputmode="tel" [(ngModel)]="otp" name="otp" required></ion-input></ion-item>
  <ion-item><ion-input label="New password" type="password" [(ngModel)]="password" name="password" required></ion-input></ion-item>
  <ion-item><ion-input label="Confirm password" type="password" [(ngModel)]="confirm" name="confirm" required></ion-input></ion-item>
  <ion-button expand="block" type="submit" [disabled]="busy || !otp || !password">Reset password</ion-button></form>
  <ion-button fill="clear" routerLink="/login-page">Back to sign in</ion-button></ion-content>` })
export class ResetPage implements OnDestroy {
  phone = ''; otp = ''; password = ''; confirm = ''; message = ''; busy = false; countdown = 0;
  readonly demoReset = !environment.production;
  private cleanPhone(value: string) { return value.replace(/[\s()+-]/g, ''); }
  private requestedPhone = '';
  private timer?: ReturnType<typeof setInterval>;
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) { }
  async send() {
    if (!this.phone.trim() || this.busy || this.countdown) return;
    this.busy = true;
    try {
      if (this.demoReset) {
        if (!/^\d{8,15}$/.test(this.cleanPhone(this.phone))) throw new Error('Enter a valid test phone number.');
      } else {
        await firstValueFrom(this.api.requestOtp(this.phone.trim(), false));
      }
      this.requestedPhone = this.phone.trim(); this.message = this.demoReset ? 'Enter the same phone number as OTP for a simulated reset. No SMS is sent.' : 'OTP requested. Check your messages.';
      this.countdown = 60;
      clearInterval(this.timer);
      this.timer = setInterval(() => { if (--this.countdown <= 0) clearInterval(this.timer); this.cdr.markForCheck(); }, 1000);
    } catch (error) { this.message = error instanceof Error ? error.message : 'OTP request failed.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async reset() {
    if (this.busy) return;
    if (this.phone.trim() !== this.requestedPhone || !this.requestedPhone) { this.message = 'Request an OTP for this phone first.'; return; }
    if (!this.password || this.password !== this.confirm) { this.message = 'Passwords must match.'; return; }
    this.busy = true;
    try {
      if (this.demoReset) {
        if (this.cleanPhone(this.otp) !== this.cleanPhone(this.phone)) throw new Error('Enter the same phone number in the OTP field.');
        this.password = ''; this.confirm = ''; this.otp = ''; this.requestedPhone = '';
        clearInterval(this.timer); this.countdown = 0;
        this.message = 'Simulated reset completed. Your real account password has not changed.';
        return;
      }
      await firstValueFrom(this.api.verifyOtp(this.phone.trim(), this.otp));
      await firstValueFrom(this.api.post('/MemberAccount/MemberResetPassword', { PhoneNumber: this.phone.trim(), NewPassword: this.password }));
      this.password = ''; this.confirm = ''; this.otp = ''; this.message = 'Password reset. You can now sign in.';
    } catch (error) { this.message = error instanceof Error ? error.message : 'Password reset failed.'; }
    finally { this.busy = false; }
  }
  ngOnDestroy() { clearInterval(this.timer); }
}
