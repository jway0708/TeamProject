import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { MemberProfile, parseMemberProfile } from './member-profile';

@Injectable({ providedIn: 'root' })
export class MemberSession {
  private readonly profileState = new BehaviorSubject<MemberProfile | null>(null);
  readonly profileChanges = this.profileState.asObservable();
  private profileVersion = 0;
  get profile(): MemberProfile | null { return this.profileState.value; }
  constructor(private api: ApiService, private router: Router) {}
  get phone(): string { return localStorage.getItem('user_phone') || ''; }
  async establish(phone: string): Promise<void> {
    const version = ++this.profileVersion;
    const response = await firstValueFrom(this.api.getMemberDetails(phone));
    if (version !== this.profileVersion) return;
    const profile = parseMemberProfile(response, phone);
    localStorage.setItem('user_phone', phone);
    this.profileState.next(profile);
  }
  clear(): void {
    this.profileVersion++;
    this.api.clearSession();
    localStorage.removeItem('user_phone');
    this.profileState.next(null);
  }
  logout(): void {
    void firstValueFrom(this.api.post('/MemberLogin/Logout', {})).catch(() => undefined);
    this.clear();
    this.router.navigateByUrl('/login-page', { replaceUrl: true });
  }
}

// This guards navigation only. The Loyalty API must authorize all private data access.
export const memberGuard: CanActivateFn = () => {
  const session = inject(MemberSession);
  return session.phone ? true : inject(Router).createUrlTree(['/login-page']);
};
