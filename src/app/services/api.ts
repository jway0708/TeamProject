import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Capacitor, CapacitorHttp, HttpOptions } from '@capacitor/core';
import { decodeResponse, loginConfirmed } from './api-response';

export const nativeHttp = { request: (options: HttpOptions) => CapacitorHttp.request(options) };

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = (Capacitor.isNativePlatform() ? environment.nativeApiBaseUrl : environment.apiBaseUrl).trim().replace(/\/+$/, '');

  readonly demoOtpEnabled = !environment.production;
  private demoRequestedPhone = '';
  private cleanPhone(value: string): string { return value.replace(/[\s()+-]/g, ''); }
  clearDemo(): void { this.demoRequestedPhone = ''; }
  requestDemoOtp(phone: string): Observable<unknown> {
    if (!this.demoOtpEnabled) return throwError(() => new Error('Phone-number OTP login is disabled in this build.'));
    if (!/^\d{8,15}$/.test(this.cleanPhone(phone))) return throwError(() => new Error('Enter a valid phone number.'));
    this.clearDemo();
    this.demoRequestedPhone = phone.trim();
    return of({ success: true });
  }
  private readonly cookieKey = 'member_session_cookie:' + this.baseUrl;
  private nativeCookie = localStorage.getItem(this.cookieKey) || '';
  clearSession(): void {
    this.clearDemo();
    this.nativeCookie = '';
    localStorage.removeItem(this.cookieKey);
  }
  constructor(private http: HttpClient) { }

  private async nativeRequest(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    if (!this.baseUrl) throw new Error('Configure the Android backend HTTPS address before using a release build.');
    const response = await nativeHttp.request({
      url: this.baseUrl + path, method,
      headers: { 'Content-Type': 'application/json', ...(this.nativeCookie ? { Cookie: this.nativeCookie } : {}) },
      ...(method === 'POST' ? { data: body } : {}),
      responseType: 'text', connectTimeout: 15000, readTimeout: 20000,
    });
    const cookie = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'set-cookie')?.[1];
    if (cookie) {
      const match = String(cookie).match(/member_session=([^; ,]*)/);
      if (match) this.nativeCookie = match[1] ? 'member_session=' + match[1] : '';
      if (this.nativeCookie) localStorage.setItem(this.cookieKey, this.nativeCookie);
      else localStorage.removeItem(this.cookieKey);
    }
    // Capacitor may already decode a JSON string into plain text.
    const raw = typeof response.data === 'string' && !/^[\s]*[\[{"]/.test(response.data)
      ? JSON.stringify(response.data) : typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    if (response.status >= 400) {
      let message = 'Backend request failed (' + response.status + ').';
      try {
        const value = JSON.parse(raw);
        message = Object.values(value.errors || {}).flat().join(' ') || value.message || value.Message || value.title || message;
      } catch { /* Use status if no JSON message. */ }
      throw Object.assign(new Error(message), { status: response.status });
    }
    return decodeResponse(raw);
  }

  // 1. 校验推荐码
  checkReferralCode(code: string): Observable<any> {
    return this.post('/MemberWallet/CheckReffererCodeValid', { ReferralBy: code });
  }

  // 2. 发送注册/登录 OTP
  requestOtp(phone: string, isRegister: boolean): Observable<any> {
    const endpoint = isRegister ? '/MemberAccount/RegisterOtp' : '/MemberAccount/RequestOTP';
    return this.post(endpoint, {
      PhoneNumber: phone,
      DeviceId: this.getClientDeviceId(),
    });
  }

  // 3. 提交注册/登录
  loginOrRegister(phone: string, otp: string, referralCode?: string, isRegister: boolean = false, details?: { Name: string; Email: string; EmailSubcribe: string; Password?: string }): Observable<any> {
    if (this.demoOtpEnabled && this.demoRequestedPhone) {
      if (this.cleanPhone(phone) !== this.cleanPhone(this.demoRequestedPhone) || this.cleanPhone(String(otp)) !== this.cleanPhone(phone)) {
        return throwError(() => new Error('Enter the same phone number in the OTP field.'));
      }
      return this.post(isRegister ? '/MemberLogin/PhoneNumberRegister' : '/MemberLogin/PhoneNumberLogin', { PhoneNumber: phone.trim(), OTP: String(otp), ...(isRegister ? { ReferralBy: referralCode?.trim() || '', ...details } : {}) });
    }
    const endpoint = isRegister ? '/MemberLogin/RegisterMember' : '/MemberLogin/MemberMobileLoginGetProfile';
    // Send the field names defined by RegisterMemberParam and LoginData in Swagger.
    const body = isRegister
      ? { PhoneNumber: phone, ReferralBy: referralCode || '', ...details }
      : { Phone: phone, OTP: String(otp), FirstLogin: false, DeviceId: this.getClientDeviceId() };
    if (isRegister) {
      // RegisterMember has no OTP parameter. Confirm the code before creating an account.
      return this.verifyOtp(phone, otp, true).pipe(switchMap(() => this.post(endpoint, body)));
    }
    return this.verifyOtp(phone, otp, false);
  }

  // 4. 获取会员完整数据 (会员卡/余额/积分)
  getMemberDetails(phone: string): Observable<unknown> {
    return this.post('/MemberDetails/GetMemberDetails', { PhoneNumber: phone });
  }

  // 5. 绑定 Android 推送 DeviceId
  updateDeviceId(phone: string, deviceId: string): Observable<any> {
    return this.post('/MemberLogin/UpdateDeviceId', {
      PhoneNumber: phone,
      DeviceId: deviceId
    });
  }

  // 6. 保持登录态 (Keep Login)
  keepLoginUser(phone: string): Observable<any> {
    return this.post('/MemberAccount/KeepLoginUser', { PhoneNumber: phone, DeviceId: this.getClientDeviceId() });
  }

  verifyOtp(phone: string, otp: string, firstLogin = false): Observable<unknown> {
    return this.post('/MemberLogin/MemberMobileLoginGetProfile', {
      Phone: phone, OTP: String(otp), FirstLogin: firstLogin, DeviceId: this.getClientDeviceId(),
    }).pipe(map(response => {
      if (!loginConfirmed(response, phone)) throw new Error('The API did not confirm OTP verification. Please check the response with the API owner.');
      return response;
    }));
  }

  loginWithEmail(email: string, password: string): Observable<unknown> {
    this.clearDemo();
    return this.post('/MemberLogin/CheckEmailPassword', { Email: email, Password: password }).pipe(map(response => {
      if (!loginConfirmed(response)) throw new Error('Email login was not confirmed by the API.');
      return response;
    }));
  }

  get(path: string): Observable<unknown> {
    if (Capacitor.isNativePlatform()) return from(this.nativeRequest('GET', path));
    return this.http.get(`${this.baseUrl}${path}`, { responseType: 'text' }).pipe(map(decodeResponse));
  }

  post<T = unknown>(path: string, body: unknown): Observable<T> {
    if (Capacitor.isNativePlatform()) return from(this.nativeRequest('POST', path, body)) as Observable<T>;
    if (!this.baseUrl) {
      return throwError(() => new Error('API address is missing. Set apiBaseUrl in the environment file.'));
    }
    return this.http.post(`${this.baseUrl}${path}`, body, { responseType: 'text' }).pipe(map(raw => decodeResponse(raw) as T));
  }

  private getClientDeviceId(): string {
    if (Capacitor.isNativePlatform()) return localStorage.getItem('push_device_id') || '';
    const storageKey = 'client_device_id';
    let deviceId = localStorage.getItem(storageKey);
    if (!deviceId) {
      deviceId = `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(storageKey, deviceId);
    }
    return deviceId;
  }
}
