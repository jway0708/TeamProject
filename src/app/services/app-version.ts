import { field } from './api-response';

export function latestAndroidVersion(versions: unknown[]): number | null {
  const codes = versions.flatMap(item => {
    const operatingSystem = String(field(item, 'OperatingSystem') ?? '').trim();
    if (operatingSystem && operatingSystem.toLowerCase() !== 'android') return [];
    const value = field(item, 'AndroidVersionCode', 'VersionCode');
    if (value == null || value === '') return [];
    const code = Number(value);
    return Number.isInteger(code) && code >= 0 ? [code] : [];
  });
  return codes.length ? Math.max(...codes) : null;
}
