import { HomepagePage } from './homepage.page';
import { Router } from '@angular/router';
import { ApiService } from '../services/api';
import { of } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { MemberSession } from '../services/member-session';

describe('HomepagePage', () => {
  it('updates a cached guest homepage when login establishes a session without re-entering the page', async () => {
    localStorage.clear();
    const api = { getMemberDetails: vi.fn(() => of({ PhoneNumber: '123', Name: 'Matt' })), clearSession: vi.fn() } as unknown as ApiService;
    const session = new MemberSession(api, {} as Router);
    const markForCheck = vi.fn();
    const page = new HomepagePage({} as Router, api, { markForCheck } as unknown as ChangeDetectorRef, session);
    page.loadMember();
    expect(page.member).toBeNull();
    markForCheck.mockClear();

    await session.establish('123');

    expect(page.member?.name).toBe('Matt');
    expect(page.loading).toBe(false);
    expect(markForCheck).toHaveBeenCalled();
    expect(api.getMemberDetails).toHaveBeenCalledTimes(1);
    session.clear();
    expect(page.member).toBeNull();
    page.ngOnDestroy();
    localStorage.clear();
  });
  it('allows guests to stay on homepage without requesting a profile', () => {
    localStorage.removeItem('user_phone');
    const getMemberDetails = vi.fn();
    const navigateByUrl = vi.fn();
    const page = new HomepagePage({ navigateByUrl } as unknown as Router, { getMemberDetails } as unknown as ApiService);
    page.loadMember();
    expect(getMemberDetails).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(page.member).toBeNull();
    expect(page.loading).toBe(false);
  });
  it('does not retain another account profile', () => {
    localStorage.setItem('user_phone', '123');
    const page = new HomepagePage({} as Router, { getMemberDetails: () => of({ PhoneNumber: '999', Name: 'Other account' }) } as unknown as ApiService);
    page.loadMember();
    expect(page.member).toBeNull(); expect(page.profileError).toContain('does not match'); page.ngOnDestroy();
    localStorage.clear();
  });
});
