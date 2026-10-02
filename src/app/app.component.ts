import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './services/api';
import { MemberSession } from './services/member-session';
import { AndroidMember } from './services/android-member';
import { loginConfirmed } from './services/api-response';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private api: ApiService, private session: MemberSession, private android: AndroidMember) {}
  ngOnInit() { void this.initialize(); }
  private async initialize() {
    if (!Capacitor.isNativePlatform()) return;
    void this.android.checkVersion();
    void this.android.registerPush(this.session.phone);
    if (!this.session.phone) return;
    try {
      const response = await firstValueFrom(this.api.keepLoginUser(this.session.phone));
      if (!loginConfirmed(response, this.session.phone)) throw new Error('Session not confirmed.');
      await this.session.establish(this.session.phone);
    } catch { this.session.clear(); }
  }
}
