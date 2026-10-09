import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadTs(path, environment) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
  } }).outputText;
  const exports = {};
  const imports = name => {
    if (name === '@angular/core') return { Injectable: () => type => type };
    if (name === '@angular/common/http') return {};
    if (name.endsWith('/environment')) return { environment };
    return require(name);
  };
  new Function('require', 'exports', js)(imports, exports);
  return exports;
}
const { parseMemberProfile } = loadTs('../src/app/services/member-profile.ts');

test('profile fields map from Swagger and preserve zero balances and missing values', () => {
  const member = parseMemberProfile({ Name: 'Alice', PhoneNumber: '+60 12-345', Tier: 'Gold',
    Balance: 0, Point: '2450', TotalStamp: 0, ReferralCode: 'ABC' }, '+6012345');
  assert.equal(member.name, 'Alice');
  assert.equal(member.balance, 0);
  assert.equal(member.points, 2450);
  assert.equal(member.stamps, 0);
  assert.equal(member.referralCode, 'ABC');
  const full = parseMemberProfile({ PhoneNumber: '123', UserId: 'user-1', BirthDate: '2000-01-02', ImageByte: 'aW1hZ2U=' }, '123');
  assert.equal(full.userId, 'user-1');
  assert.equal(full.birthday, '2000-01-02');
  assert.equal(full.imageByte, 'aW1hZ2U=');
  assert.equal(parseMemberProfile({ data: { phoneNumber: '123', balance: null } }, '123').balance, null);
  assert.equal(parseMemberProfile({ PhoneNumber: '123', Balance: 'invalid' }, '123').balance, null);
});

test('failed, malformed and other-account profiles are rejected', () => {
  assert.throws(() => parseMemberProfile({ PhoneNumber: '999' }, '123'), /does not match/);
  assert.throws(() => parseMemberProfile({ success: false, data: { PhoneNumber: '123' } }, '123'), /Unable to load/);
  assert.throws(() => parseMemberProfile('invalid', '123'), /not recognised/);
});

