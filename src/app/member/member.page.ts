import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule, AlertController } from '@ionic/angular/lazy';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';
import { ApiService } from '../services/api';
import { ApiRecord, field, records } from '../services/api-response';
import { MemberSession } from '../services/member-session';
import { AndroidMember } from '../services/android-member';

const titles: Record<string, string> = {
  rewards: 'Rewards', vouchers: 'Vouchers', stamps: 'Stamps', history: 'History',
  notifications: 'Notifications', stores: 'Stores', refer: 'Refer a friend', wallet: 'Wallet',
  profile: 'My profile', feedback: 'Feedback', qr: 'Member QR', highlight: 'Promotions',
};
const histories: Record<string, string> = {
  all: '/History/GetAllRecordByPhoneNumber', topups: '/History/GetTopUpRecordByPhoneNumber',
  payments: '/History/GetPaymentRecordByPhoneNumber', points: '/History/GetAssignPointRecordByPhoneNumber',
  assignedStamps: '/History/GetAssignStampRecordByPhoneNumber', stamps: '/History/GetStampRecordByPhoneNumber',
  rewards: '/History/GetRedeemRewardRecordByPhoneNumber', vouchers: '/History/GetRedeemVoucherRecordByPhoneNumber',
  spending: '/MemberAccount/GetSpendRecords', voucherUse: '/MemberAccount/GetMemberVoucherHistories',
};

@Component({
  selector: 'app-member', standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonicModule],
  templateUrl: './member.page.html', styleUrls: ['./member.page.scss']
})
export class MemberPage {
  area = '';
  title = '';
  loading = false;
  error = '';
  notice = '';
  items: ApiRecord[] = [];
  selected: ApiRecord | null = null;
  filter = 'all';
  qrImage = '';
  qrTitle = '';
  name = '';
  email = '';
  birthday = '';
  photo = '';
  photoMime = 'image/jpeg';
  feedbackTitle = '';
  description = '';
  rating = '5';
  category = '';
  feedbackLocation = '';
  readonly historyOptions = Object.keys(histories);
  constructor(private route: ActivatedRoute, private api: ApiService, public session: MemberSession,
    public android: AndroidMember, private alerts: AlertController) { }

  ionViewWillEnter() {
    this.area = this.route.snapshot.data['area'];
    this.title = titles[this.area] || 'Member';
    this.filter = 'all';
    this.selected = null;
    this.qrImage = '';
    void this.load();
  }
  read(item: unknown, ...keys: string[]): string {
    const value = field(item, ...keys);
    return value == null ? '' : String(value);
  }
  label(item: ApiRecord): string {
    return this.read(item, 'Name', 'Title', 'ShortTitle', 'Description', 'Type') || 'Record';
  }
  id(item: ApiRecord): string {
    const keys = this.area === 'notifications' ? ['Notification_Id', 'NotificationId', 'Id']
      : this.area === 'history' || this.area === 'wallet' ? ['TopupId', 'Id'] : ['RewardId', 'StampId', 'Id'];
    return this.read(item, ...keys);
  }
  async load(): Promise<void> {
    this.loading = true; this.error = ''; this.items = []; this.selected = null;
    try {
      const phone = { PhoneNumber: this.session.phone };
      let result: unknown;
      switch (this.area) {
        case 'rewards': result = this.filter === 'mine' ? await this.post('/MemberAccount/GetMemberReward', phone) : await this.get('/MemberReward/GetRewards'); break;
        case 'vouchers': result = this.filter === 'mine' ? await this.post('/MemberVoucher/GetVoucherByPhone', phone) : await this.get('/MemberVoucher/GetAllVoucher'); break;
        case 'stamps': result = await this.post(this.filter === 'used' ? '/MemberAccount/GetMemberStampUsedRecord' : '/MemberAccount/GetMemberStampList', phone); break;
        case 'history': result = await this.post(histories[this.filter] || histories['all'], phone); break;
        case 'notifications': result = await this.post('/MemberNotification/GetNotificationsFilterMember', phone); break;
        case 'stores': result = await this.get('/ManageOutlets/GetAllOutlets'); break;
        case 'highlight': result = await this.get('/ManageHighlight/UserGetAllHighlight'); break;
        case 'wallet': result = await this.post(this.filter === 'topups' ? '/History/GetTopUpRecordByPhoneNumber' : '/MemberWallet/MemberGetWalletDetails', phone); break;
        case 'refer':
          await this.session.establish(this.session.phone);
          if (!this.session.profile?.referralCode) { this.notice = 'No referral code is available for your account.'; return; }
          result = await this.post('/MemberAccount/GetMemberDownlineList', { ReferralCode: this.session.profile.referralCode }); break;
        case 'profile':
          await this.session.establish(this.session.phone);
          this.name = this.session.profile?.name || ''; this.email = this.session.profile?.email || '';
          this.birthday = this.session.profile?.birthday?.slice(0, 10) || '';
          this.photo = this.session.profile?.imageByte || '';
          return;
        case 'feedback':
          if (!this.session.profile) await this.session.establish(this.session.phone);
          const userId = this.session.profile?.userId;
          if (!userId) throw new Error('Your user ID is missing from the member profile.');
          result = await this.post('/FeedBack/GetFeedbackListFilterUser', { UserId: userId }); break;
        case 'qr':
          await this.session.establish(this.session.phone);
          this.qrTitle = 'Member QR';
          // The scan-member endpoint accepts a phone number. Confirm payload with the API owner.
          this.qrImage = await QRCode.toDataURL(this.session.phone, { width: 360, margin: 4 });
          return;
        default: return;
      }
      this.items = records(result);
    } catch (error) { this.error = this.message(error); }
    finally { this.loading = false; }
  }
  async detail(item: ApiRecord): Promise<void> {
    this.error = ''; this.qrImage = '';
    try {
      const id = this.id(item);
      let result: unknown = item;
      if (this.area === 'rewards') result = await this.post('/MemberReward/FindReward', { RewardId: id });
      if (this.area === 'vouchers') result = await this.post('/MemberVoucher/GetVoucherById', { RewardId: id, PhoneNumber: this.session.phone });
      if (this.area === 'notifications') result = await this.post('/MemberNotification/GetNotificationsDetails', { Notification_Id: id });
      if ((this.area === 'wallet' && this.filter === 'topups') || (this.area === 'history' && this.filter === 'topups')) {
        result = await this.post('/MemberAccount/GetTopUpRecordDetails', { TopupId: id });
      }
      this.selected = records(result)[0] || null;
    } catch (error) { this.error = this.message(error); }
  }
  async rewardQr(item: ApiRecord): Promise<void> {
    try {
      const value = this.read(item, 'QRCode', 'QRValue', 'QRContent');
      if (!value) throw new Error('A redemption QR is not available yet. Please contact the store.');
      this.qrTitle = this.label(item);
      this.qrImage = await QRCode.toDataURL(value, { width: 360, margin: 4 });
    } catch (error) { this.error = this.message(error); }
  }
  async markRead(item?: ApiRecord): Promise<void> {
    await this.perform(() => this.post(item ? '/MemberNotification/UserReadNotification' : '/MemberNotification/UserReadAllNotification',
      item ? { PhoneNumber: this.session.phone, NotificationId: this.id(item) } : { PhoneNumber: this.session.phone }), 'Notifications marked as read.');
    if (!this.error) await this.load();
  }
  async share(): Promise<void> {
    try { await this.android.shareReferral(this.session.profile?.referralCode || ''); }
    catch (error) { this.error = this.message(error); }
  }
  async map(item: ApiRecord): Promise<void> {
    try {
      const lat = Number(this.read(item, 'Latitude')); const lon = Number(this.read(item, 'Longitude'));
      if (!this.read(item, 'Latitude') || !this.read(item, 'Longitude') || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('Map location is not available for this store.');
      }
      const location = await this.android.location();
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${lat},${lon}`, '_system');
    } catch (error) { this.error = this.message(error); }
  }
  async saveProfile(): Promise<void> {
    await this.perform(() => this.post('/MemberAccount/MemberEditProfile', {
      PhoneNumber: this.session.phone, UserName: this.name.trim(), Email: this.email.trim(),
      Birthday: this.birthday || null, ImageByte: this.photo || null,
    }), 'Profile saved.');
  }
  async choosePhoto(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2_000_000) { this.error = 'Choose an image smaller than 2 MB.'; return; }
    const reader = new FileReader();
    reader.onload = () => { this.photo = String(reader.result).split(',')[1] || ''; this.photoMime = file.type; };
    reader.readAsDataURL(file);
  }
  async emailOtp(): Promise<void> {
    await this.perform(() => this.post('/MemberAccount/GenerateMailOTP', {
      PhoneNumber: this.session.phone,
      DeviceId: localStorage.getItem('push_device_id') || ''
    }), 'Email verification requested.');
  }
  async deactivate(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Deactivate account?',
      message: 'This API deactivates your account. Complete deletion of account data is not supported by the documented API.',
      buttons: [{ text: 'Cancel', role: 'cancel' }, {
        text: 'Deactivate', role: 'destructive', handler: () => {
          void this.perform(async () => { const result = await this.post('/MemberAccount/UpdateAccountStatusDeactive', { PhoneNumber: this.session.phone }); this.session.logout(); return result; }, 'Account deactivated.');
        }
      }]
    });
    await alert.present();
  }
  async sendFeedback(): Promise<void> {
    if (!this.feedbackTitle.trim() || !this.description.trim()) { this.error = 'Enter a title and your feedback.'; return; }
    await this.perform(() => this.post('/FeedBack/CreateFeedback', {
      Title: this.feedbackTitle, Description: this.description, Rating: this.rating,
      Category: this.category, UserId: this.session.profile?.userId, Location: this.feedbackLocation,
    }), 'Feedback submitted.');
    if (!this.error) { this.feedbackTitle = ''; this.description = ''; await this.load(); }
  }
  private get(path: string) { return firstValueFrom(this.api.get(path)); }
  private post(path: string, body: unknown) { return firstValueFrom(this.api.post(path, body)); }
  private message(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unable to complete this request. Please try again.';
  }
  private async perform(action: () => Promise<unknown>, notice: string): Promise<void> {
    if (this.loading) return;
    this.loading = true; this.error = ''; this.notice = '';
    try { await action(); this.notice = notice; }
    catch (error) { this.error = this.message(error); }
    finally { this.loading = false; }
  }
}
