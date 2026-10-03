import { ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../services/api';
import { ResetPage } from './reset.page';

describe('ResetPage demo reset', () => {
  it('accepts the requested phone without sending SMS or changing a real password', async () => {
    const api = { requestOtp: vi.fn(), verifyOtp: vi.fn(), post: vi.fn() };
    const page = new ResetPage(api as unknown as ApiService, { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    page.phone = '+60123456789';
    page.password = page.confirm = 'test-password';
    await page.reset();
    expect(page.message).toContain('Request an OTP');
    await page.send();
    page.otp = '999';
    await page.reset();
    expect(page.message).toContain('same phone number');
    page.otp = '60123456789';
    await page.reset();
    expect(page.message).toContain('real account password has not changed');
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(api.verifyOtp).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(page.password).toBe('');
    page.ngOnDestroy();
  });
});
