import { decodeResponse, loginConfirmed, records } from './api-response';

describe('API response handling', () => {
  it('rejects a false result or a quoted backend error despite HTTP 200', () => {
    expect(() => decodeResponse('false')).toThrow();
    expect(() => decodeResponse('"The remote server returned an error: (400) Bad Request."')).toThrow();
    expect(() => decodeResponse('{"success":true,"isSuccess":false}')).toThrow();
    expect(() => decodeResponse('{"message":"The remote server returned an error: (400) Bad Request."}')).toThrow();
  });
  it('does not accept a profile for another phone as a login', () => {
    expect(loginConfirmed({ success: true, PhoneNumber: '999' }, '123')).toBe(false);
    expect(loginConfirmed({ data: { PhoneNumber: '123' } }, '123')).toBe(true);
    expect(loginConfirmed({ message: 'unknown' }, '123')).toBe(false);
  });
  it('reads empty or wrapped lists without inventing records', () => {
    expect(records({ Data: [] })).toEqual([]);
    expect(records({ Items: [{ Name: 'Reward' }] })).toHaveLength(1);
    expect(() => records('unsupported')).toThrow();
  });
  it('reads JSON-encoded lists from .NET responses and nested data', () => {
    const reward = { RewardId: 'r1', Name: 'Cash voucher' };
    expect(records(decodeResponse(JSON.stringify(JSON.stringify([reward]))))).toEqual([reward]);
    expect(records({ Data: JSON.stringify([reward]) })).toEqual([reward]);
    expect(records('[]')).toEqual([]);
    expect(records('null')).toEqual([]);
    expect(records('')).toEqual([]);
  });
  it('keeps backend failures visible inside encoded data', () => {
    expect(() => records({ Data: JSON.stringify({ Success: false, Message: 'Request failed' }) })).toThrow('Request failed');
    expect(() => records('The service is unavailable')).toThrow('The service is unavailable');
    expect(() => records('true')).toThrow();
  });
});
