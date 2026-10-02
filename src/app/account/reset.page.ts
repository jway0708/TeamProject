import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api';

@Component({
  standalone: true, imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  template: `<ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/login-page"></ion-back-button></ion-buttons><ion-title>Reset password</ion-title></ion-toolbar></ion-header>
  <ion-content class="ion-padding"><p role="status">{{ message }}</p>
  <form (ngSubmit)="reset()"><ion-item><ion-input label="Phone number" type="tel" [(ngModel)]="phone" name="phone" required></ion-input></ion-item>
  <ion-button type="button" (click)="send()" [disabled]="busy || countdown > 0">{{ countdown ? countdown + 's' : 'Get OTP' }}</ion-button>
  <ion-item><ion-input label="OTP" type="text" inputmode="numeric" [(ngModel)]="otp" name="otp" required></ion-input></ion-item>
  <ion-item><ion-input label="New password" type="password" [(ngModel)]="password" name="password" required></ion-input></ion-item>
  <ion-item><ion-input label="Confirm password" type="password" [(ngModel)]="confirm" name="confirm" required></ion-input></ion-item>
  <ion-button expand="block" type="submit" [disabled]="busy || !otp || !password">Reset password</ion-button></form>
  <ion-button fill="clear" routerLink="/login-page">Back to sign in</ion-button></ion-content>` })
export class ResetPage implements OnDestroy {
  phone = ''; otp = ''; password = ''; confirm = ''; message = ''; busy = false; countdown = 0;
  private requestedPhone = '';
  private timer?: ReturnType<typeof setInterval>;
  constructor(private api: ApiService) { }
  async send() {
    if (!this.phone.trim() || this.busy || this.countdown) return;
    this.busy = true;
    try {
      await firstValueFrom(this.api.requestOtp(this.phone.trim(), false));
      this.requestedPhone = this.phone.trim(); this.message = 'OTP requested. Check your messages.';
      this.countdown = 60;
      clearInterval(this.timer);
      this.timer = setInterval(() => { if (--this.countdown <= 0) clearInterval(this.timer); }, 1000);
    } catch (error) { this.message = error instanceof Error ? error.message : 'OTP request failed.'; }
    finally { this.busy = false; }
  }
  async reset() {
    if (this.busy) return;
    if (this.phone.trim() !== this.requestedPhone || !this.requestedPhone) { this.message = 'Request an OTP for this phone first.'; return; }
    if (!this.password || this.password !== this.confirm) { this.message = 'Passwords must match.'; return; }
    this.busy = true;
    try {
      await firstValueFrom(this.api.verifyOtp(this.phone.trim(), this.otp));
      await firstValueFrom(this.api.post('/MemberAccount/MemberResetPassword', { PhoneNumber: this.phone.trim(), NewPassword: this.password }));
      this.password = ''; this.confirm = ''; this.otp = ''; this.message = 'Password reset. You can now sign in.';
    } catch (error) { this.message = error instanceof Error ? error.message : 'Password reset failed.'; }
    finally { this.busy = false; }
  }
  ngOnDestroy() { clearInterval(this.timer); }
}
