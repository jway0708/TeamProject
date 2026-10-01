import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl.trim().replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  // 1. 校验推荐码
  checkReferralCode(code: string): Observable<any> {
    return this.post('/MemberWallet/CheckReffererCodeValid', { ReferralCode: code });
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
  loginOrRegister(phone: string, otp: string, referralCode?: string, isRegister: boolean = false): Observable<any> {
    const endpoint = isRegister ? '/MemberLogin/RegisterMember' : '/MemberLogin/MemberMobileLoginGetProfile';
    return this.post(endpoint, {
      PhoneNumber: phone,
      OtpCode: otp,
      ReferralCode: referralCode || ''
    });
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
    return this.post('/MemberAccount/KeepLoginUser', { PhoneNumber: phone });
  }

  private post<T = unknown>(path: string, body: unknown): Observable<T> {
    if (!this.baseUrl) {
      return throwError(() => new Error('API address is missing. Set apiBaseUrl in the environment file.'));
    }
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  private getClientDeviceId(): string {
    const storageKey = 'client_device_id';
    let deviceId = localStorage.getItem(storageKey);
    if (!deviceId) {
      deviceId = `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(storageKey, deviceId);
    }
    return deviceId;
  }
}
