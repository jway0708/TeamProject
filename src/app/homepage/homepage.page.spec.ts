import { HomepagePage } from './homepage.page';
import { Router } from '@angular/router';
import { ApiService } from '../services/api';
import { of } from 'rxjs';

describe('HomepagePage', () => {
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
