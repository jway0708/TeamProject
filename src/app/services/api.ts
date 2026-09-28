import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // ⚠️ 注意：换成你们团队后端的真实 URL
  private baseUrl = 'https://your-backend-domain.com/api';

  constructor(private http: HttpClient) {}

  // 1. 校验推荐码
  checkReferralCode(code: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/MemberWallet/CheckReffererCodeValid`, { ReferralCode: code });
  }

  // 2. 发送注册/登录 OTP
  requestOtp(phone: string, isRegister: boolean): Observable<any> {
    const endpoint = isRegister ? '/MemberAccount/RegisterOtp' : '/MemberAccount/RequestOTP';
    return this.http.post(`${this.baseUrl}${endpoint}`, { PhoneNumber: phone });
  }

  // 3. 提交注册/登录
  loginOrRegister(phone: string, otp: string, referralCode?: string, isRegister: boolean = false): Observable<any> {
    const endpoint = isRegister ? '/MemberLogin/RegisterMember' : '/MemberLogin/MemberMobileLoginGetProfile';
    return this.http.post(`${this.baseUrl}${endpoint}`, {
      PhoneNumber: phone,
      OtpCode: otp,
      ReferralCode: referralCode || ''
    });
  }

  // 4. 获取会员完整数据 (会员卡/余额/积分)
  getMemberDetails(phone: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/MemberDetails/GetMemberDetails`, { PhoneNumber: phone });
  }

  // 5. 绑定 Android 推送 DeviceId
  updateDeviceId(phone: string, deviceId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/MemberLogin/UpdateDeviceId`, {
      PhoneNumber: phone,
      DeviceId: deviceId
    });
  }

  // 6. 保持登录态 (Keep Login)
  keepLoginUser(phone: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/MemberAccount/KeepLoginUser`, { PhoneNumber: phone });
  }
}