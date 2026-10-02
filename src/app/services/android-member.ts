import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Share } from '@capacitor/share';
import { Geolocation } from '@capacitor/geolocation';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { field, records } from './api-response';
import { AlertController } from '@ionic/angular/lazy';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AndroidMember {
  pushError = '';
  updateError = '';
  private initialized = false;
  constructor(private api: ApiService, private alerts: AlertController) {}

  async checkVersion(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const info = await App.getInfo();
      const versions = records(await firstValueFrom(this.api.get('/ManageVersion/GetAllVersion')));
      const codes = versions.map(item => Number(field(item, 'AndroidVersionCode'))).filter(Number.isFinite);
      if (!codes.length) throw new Error('Android version configuration was not returned by the API.');
      const latest = Math.max(...codes);
      if (latest <= Number(info.build)) return;
      const alert = await this.alerts.create({ header: 'Update required',
        message: 'Please install the latest app version to continue.', backdropDismiss: false,
        buttons: [{ text: 'Open Play Store', handler: () => {
          window.open(`https://play.google.com/store/apps/details?id=${encodeURIComponent(info.id)}`, '_system');
          return false;
        } }] });
      await alert.present();
    } catch (error) { this.updateError = error instanceof Error ? error.message : 'App version check failed.'; }
  }

  async registerPush(phone: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!environment.pushEnabled) {
      this.pushError = 'Push alerts are not configured for this app yet.';
      return;
    }
    this.pushError = '';
    try {
      if (!this.initialized) {
        await PushNotifications.addListener('registration', async token => {
          localStorage.setItem('push_device_id', token.value);
          const currentPhone = localStorage.getItem('user_phone');
          if (!currentPhone) return;
          try { await firstValueFrom(this.api.updateDeviceId(currentPhone, token.value)); }
          catch { this.pushError = 'Push registration could not be saved. Retry in Notifications.'; }
        });
        await PushNotifications.addListener('registrationError', () => {
          this.pushError = 'Push is not configured. Check Firebase configuration.';
        });
        this.initialized = true;
      }
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        this.pushError = 'Notification permission was not granted.';
        return;
      }
      await PushNotifications.register();
      const id = localStorage.getItem('push_device_id');
      if (id && phone) await firstValueFrom(this.api.updateDeviceId(phone, id));
    } catch { this.pushError = 'Push is unavailable. Check notification permission and Firebase configuration.'; }
  }

  async shareReferral(code: string): Promise<void> {
    await Share.share({ title: 'My referral code', text: `Join using my referral code: ${code}` });
  }
  async location(): Promise<{ latitude: number; longitude: number }> {
    const location = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
    return location.coords;
  }
  async appVersion(): Promise<string> {
    return Capacitor.isNativePlatform() ? (await App.getInfo()).version : '';
  }
}
