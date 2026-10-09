export type ApiRecord = Record<string, unknown>;

export function referralCodeValid(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() === 'referral code exist';
  if (value === true) return true;
  return field(value, 'IsValid') === true;
}

export function field(value: unknown, ...names: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match) return match[1];
  }
  return undefined;
}

export function decodeResponse(raw: string): unknown {
  let value: unknown;
  try { value = raw.trim() ? JSON.parse(raw) : null; }
  catch { throw new Error(raw.trim().slice(0, 240) || 'The API returned an empty response.'); }
  if (typeof value === 'string' && /error|bad request|unauthorized|exception|failed|invalid/i.test(value)) {
    throw new Error(value.slice(0, 240));
  }
  const message = field(value, 'Message');
  if (typeof message === 'string' && /remote server returned an error|bad request|unauthorized|exception|failed|invalid/i.test(message)) {
    throw new Error(message.slice(0, 240));
  }
  if (value === false || field(value, 'Success') === false || field(value, 'IsSuccess') === false || field(value, 'Error', 'Errors')) {
    throw new Error(String(field(value, 'Message', 'Error') || 'The API could not complete this request.'));
  }
  return value;
}

export function records(value: unknown, depth = 0): ApiRecord[] {
  if (depth > 8) throw new Error('The API response format is not supported.');
  // Some .NET endpoints serialize the list before returning it as JSON.
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    if (/^no (?:record|records|rewards records|down line records|spend records|vouchers records) found\.?$/i.test(text)) return [];
    let decoded: unknown;
    try { decoded = decodeResponse(text); }
    catch { throw new Error(text.slice(0, 240)); }
    return records(decoded, depth + 1);
  }
  if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object' && !Array.isArray(item));
  for (const key of ['Data', 'Items', 'Results', 'Records']) {
    const nested = field(value, key);
    if (nested !== undefined) return records(nested, depth + 1);
  }
  if (value == null) return [];
  if (typeof value === 'object') return [value as ApiRecord];
  throw new Error('The API response format is not supported.');
}

export function loginConfirmed(value: unknown, phone?: string): boolean {
  if (field(value, 'Success') === false || field(value, 'IsSuccess') === false || field(value, 'Error', 'Errors')) return false;
  const responsePhone = field(value, 'PhoneNumber', 'Phone');
  if (!phone && typeof responsePhone === 'string' && responsePhone.trim()) return true;
  if (phone && typeof responsePhone === 'string') {
    const clean = (number: string) => number.replace(/[\s()+-]/g, '');
    return clean(phone) === clean(responsePhone);
  }
  if (field(value, 'Success', 'IsSuccess') === true) return true;
  const nested = field(value, 'Data');
  return nested != null ? loginConfirmed(nested, phone) : false;
}
