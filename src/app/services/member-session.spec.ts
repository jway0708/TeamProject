import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { MemberSession } from './member-session';
import { ApiService } from './api';

describe('MemberSession requests', () => {
  it('does not restore a profile after logout while its request is in flight', async () => {
    localStorage.clear();
    const response = new Subject<unknown>();
    const session = new MemberSession({ getMemberDetails: () => response, clearSession: vi.fn() } as unknown as ApiService, {} as Router);
    const loading = session.establish('123');
    session.clear();
    response.next({ PhoneNumber: '123', Name: 'Former member' });
    await loading;
    expect(session.profile).toBeNull();
    expect(session.phone).toBe('');
  });
});
