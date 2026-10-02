export interface MemberProfile {
  userId: string;
  birthday: string;
  image: string;
  imageByte: string;
  name: string;
  phone: string;
  email: string;
  tier: string;
  balance: number | null;
  points: number | null;
  stamps: number | null;
  referralCode: string;
}

// Swagger's MemberDetails model uses flat PascalCase fields.
export function parseMemberProfile(response: unknown, expectedPhone: string): MemberProfile {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Member profile response is not recognised.');
  }
  const raw = response as Record<string, unknown>;
  const entries = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
  if (entries['success'] === false || entries['issuccess'] === false) {
    throw new Error('Unable to load your member profile.');
  }
  if (entries['data'] && typeof entries['data'] === 'object') {
    return parseMemberProfile(entries['data'], expectedPhone);
  }
  const text = (key: string) => typeof entries[key] === 'string' ? (entries[key] as string).trim() : '';
  const numeric = (key: string): number | null => {
    const value = entries[key];
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const phone = text('phonenumber');
  const canonical = (value: string) => value.replace(/[\s()+-]/g, '');
  if (!phone || canonical(phone) !== canonical(expectedPhone)) {
    throw new Error('Member profile does not match the signed-in phone number.');
  }
  return {
    userId: text('userid'),
    birthday: text('birthdate'), image: text('image'), imageByte: text('imagebyte'),
    name: text('name') || phone, phone, email: text('email'), tier: text('tier') || 'Member',
    balance: numeric('balance'), points: numeric('point'), stamps: numeric('totalstamp'),
    referralCode: text('referralcode'),
  };
}
