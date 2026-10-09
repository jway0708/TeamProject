import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/lazy';
import { of, Subject } from 'rxjs';
import { MemberPage } from './member.page';
import { ApiService } from '../services/api';
import { MemberSession } from '../services/member-session';
import { AndroidMember } from '../services/android-member';

describe('MemberPage list requests', () => {
  it('keeps the latest selected filter when an earlier request finishes later', async () => {
    const catalogue = new Subject<unknown>();
    const mine = new Subject<unknown>();
    const page = new MemberPage(
      { snapshot: { data: { area: 'rewards' } } } as unknown as ActivatedRoute,
      { get: () => catalogue, post: () => mine } as unknown as ApiService,
      { phone: '123' } as MemberSession, {} as AndroidMember, {} as AlertController,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    const initialLoad = page.load();
    page.filter = 'mine';
    const latestLoad = page.load();
    mine.next([{ Name: 'My reward' }]);
    await latestLoad;
    catalogue.next([{ Name: 'Catalogue reward' }]);
    await initialLoad;
    expect(page.items).toEqual([{ Name: 'My reward' }]);
    expect(page.error).toBe('');
  });
});

describe('MemberPage referred friends', () => {
  function createPage(response: unknown) {
    const post = vi.fn(() => of(response));
    const session = {
      phone: '123', profile: { referralCode: 'MWODJ' }, establish: vi.fn(async () => undefined),
    } as unknown as MemberSession;
    const page = new MemberPage(
      { snapshot: { data: { area: 'refer' } } } as unknown as ActivatedRoute,
      { post } as unknown as ApiService, session, {} as AndroidMember, {} as AlertController,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    return { page, post };
  }

  it('loads friends linked to the current member referral code', async () => {
    const friend = { Name: 'Test Friend', PhoneNumber: '0123456789' };
    const { page, post } = createPage({ Data: [friend] });
    await page.load();
    expect(post).toHaveBeenCalledWith('/MemberAccount/GetMemberDownlineList', { ReferralCode: 'MWODJ' });
    expect(page.items).toEqual([friend]);
    expect(page.label(page.items[0])).toBe('Test Friend');
    expect(page.error).toBe('');
  });

  it('treats the real no-friends response as an empty list', async () => {
    const { page } = createPage('No Down Line Records Found');
    await page.load();
    expect(page.items).toEqual([]);
    expect(page.error).toBe('');
  });

  it('keeps actual backend failures visible', async () => {
    const { page } = createPage('The service is unavailable');
    await page.load();
    expect(page.error).toContain('unavailable');
  });
});

describe('MemberPage profile', () => {
  it('shows login profile before Ionic entry and avoids fetching it again; refreshes after saving', async () => {
    localStorage.clear();
    const getMemberDetails = vi.fn(() => of({ PhoneNumber: '123', Name: 'Matt', Email: 'm@example.test' }));
    const api = { getMemberDetails, post: vi.fn(() => of({ success: true })), clearSession: vi.fn() } as unknown as ApiService;
    const session = new MemberSession(api, {} as Router);
    await session.establish('123');
    getMemberDetails.mockClear();
    const page = new MemberPage(
      { snapshot: { data: { area: 'profile' } } } as unknown as ActivatedRoute,
      api, session, {} as AndroidMember, {} as AlertController,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );

    expect(page.area).toBe('profile');
    expect(page.title).toBe('My profile');
    expect(page.name).toBe('Matt');
    expect(page.email).toBe('m@example.test');
    await page.load();
    expect(getMemberDetails).not.toHaveBeenCalled();
    expect(page.loading).toBe(false);

    await page.saveProfile();
    expect(getMemberDetails).toHaveBeenCalledTimes(1);
    session.clear();
  });
});

describe('MemberPage redemption QR', () => {
  function createPage(response: unknown = {}) {
    return new MemberPage(
      { snapshot: { data: { area: 'rewards' } } } as unknown as ActivatedRoute,
      { post: () => of(response) } as unknown as ApiService,
      { phone: '123' } as MemberSession, {} as AndroidMember, {} as AlertController,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
  }

  it('keeps member QR data when reward details only return catalogue fields', async () => {
    const page = createPage({ RewardId: 'reward-1', Name: 'Voucher', QRCode: null });
    await page.detail({ RewardId: 'reward-1', QRCode: 'member-redemption-code' });
    expect(page.read(page.selected, 'QRCode')).toBe('member-redemption-code');
  });

  it('keeps the modal open with an explanation when no QR is provided', async () => {
    const page = createPage();
    page.selected = { Name: 'Voucher' };
    await page.rewardQr(page.selected);
    expect(page.error).toContain('A redemption QR is not available');
    expect(page.selected).not.toBeNull();
    expect(page.qrImage).toBe('');
  });

  it('displays the generated QR within the open details and clears an earlier error', async () => {
      const page = createPage();
      page.selected = { Name: 'Voucher', QRContent: 'redemption-code' };
      page.error = 'Earlier error';
      await page.rewardQr(page.selected);
      expect(page.qrImage).toMatch(/^data:image\/png;base64,/);
      expect(page.selected).not.toBeNull();
      expect(page.error).toBe('');
  });
});
