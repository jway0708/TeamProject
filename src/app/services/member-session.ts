import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { MemberProfile, parseMemberProfile } from './member-profile';

@Injectable({ providedIn: 'root' })
export class MemberSession {
  profile: MemberProfile | null = null;
  constructor(private api: ApiService, private router: Router) {}
  get phone(): string { return localStorage.getItem('user_phone') || ''; }
  async establish(phone: string): Promise<void> {
    const response = await firstValueFrom(this.api.getMemberDetails(phone));
    const profile = parseMemberProfile(response, phone);
    this.profile = profile;
    localStorage.setItem('user_phone', phone);
  }
  clear(): void {
    this.api.clearDemo();
    this.profile = null;
    localStorage.removeItem('user_phone');
  }
  logout(): void {
    this.clear();
    this.router.navigateByUrl('/login-page', { replaceUrl: true });
  }
}

// This guards navigation only. The Loyalty API must authorize all private data access.
export const memberGuard: CanActivateFn = () => {
  const session = inject(MemberSession);
  return session.phone ? true : inject(Router).createUrlTree(['/login-page']);
};
