import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { MemberSession } from '../services/member-session';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api';
import { MemberProfile, parseMemberProfile } from '../services/member-profile';
import { ApiRecord, field, records } from '../services/api-response';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.page.html',
  styleUrls: ['./homepage.page.scss'],
  standalone: false,
})
export class HomepagePage implements OnDestroy {
  member: MemberProfile | null = null;
  loading = false;
  profileError = '';
  private profileRequest?: Subscription;
  banners: ApiRecord[] = [];
  rewards: ApiRecord[] = [];
  contentError = '';
  readonly shortcuts = [
    { label: 'Stamps', icon: 'checkmark-circle-outline', url: '/tabs/stamps' },
    { label: 'Vouchers', icon: 'ticket-outline', url: '/tabs/vouchers' },
    { label: 'Stores', icon: 'location-outline', url: '/tabs/stores' },
    { label: 'Refer', icon: 'person-add-outline', url: '/tabs/refer' },
  ];

  constructor(private router: Router, private api: ApiService, private cdr?: ChangeDetectorRef, private session?: MemberSession) {}

  ionViewWillEnter() { this.loadMember(); void this.loadContent(); }
  read(value: unknown, ...keys: string[]): string { return String(field(value, ...keys) ?? ''); }
  image(value: unknown): string {
    const url = this.read(value, 'Image');
    return /^https:\/\//i.test(url) ? url : '';
  }
  async loadContent() {
    this.banners = []; this.rewards = []; this.contentError = '';
    const results = await Promise.allSettled([
      firstValueFrom(this.api.get('/ManageHighlight/UserGetAllHighlight')),
      firstValueFrom(this.api.get('/MemberReward/GetRewards')),
    ]);
    try {
      if (results[0].status === 'fulfilled') this.banners = records(results[0].value);
      else this.contentError = 'Promotions could not be loaded.';
      if (results[1].status === 'fulfilled') this.rewards = records(results[1].value).slice(0, 4);
      else this.contentError += ' Rewards could not be loaded.';
    } catch (error) { this.contentError = error instanceof Error ? error.message : 'Unable to load content.'; }
    this.cdr?.markForCheck();
  }

  loadMember() {
    this.profileRequest?.unsubscribe();
    this.member = this.session?.profile ?? null;
    this.profileError = '';
    const phone = localStorage.getItem('user_phone')?.trim();
    if (!phone) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.profileRequest = this.api.getMemberDetails(phone).subscribe({
      next: response => {
        try { this.member = parseMemberProfile(response, phone); }
        catch (error) { this.profileError = error instanceof Error ? error.message : 'Unable to load member profile.'; }
        this.loading = false;
        this.cdr?.markForCheck();
      },
      error: error => {
        this.loading = false;
        if (error.status === 401) {
          localStorage.removeItem('user_phone');
          this.profileError = 'Your session has expired. Please sign in to view your member details.';
          return;
        }
        this.profileError = error.error?.message || error.message || 'Unable to load member profile.';
      },
    });
  }

  ionViewWillLeave() { this.profileRequest?.unsubscribe(); }
  ngOnDestroy() { this.profileRequest?.unsubscribe(); }

  // Function for the Show QR button
  showQRCode() {
    this.router.navigateByUrl('/member-qr');
  }

  // Function for the notifications button
  openNotifications() {
    this.router.navigateByUrl('/tabs/notifications');
  }

  // Function for redeeming rewards
  redeemReward(rewardName: string) {
    this.router.navigateByUrl('/tabs/rewards');
  }

}
