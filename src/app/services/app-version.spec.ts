import { latestAndroidVersion } from './app-version';

describe('Android version configuration', () => {
  it('uses real VersionCode fields and ignores iOS versions', () => {
    expect(latestAndroidVersion([
      { OperatingSystem: 'Android', VersionCode: 2 },
      { OperatingSystem: 'iOS', VersionCode: 100 },
      { OperatingSystem: 'android', VersionCode: '3' },
    ])).toBe(3);
    expect(latestAndroidVersion([{ AndroidVersionCode: 4 }])).toBe(4);
  });
  it('rejects empty, invalid and non-Android configuration', () => {
    expect(latestAndroidVersion([{ OperatingSystem: 'iOS', VersionCode: 2 }, { VersionCode: null }, { VersionCode: 'invalid' }])).toBeNull();
  });
});
