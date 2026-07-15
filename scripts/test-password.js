const assert = require('assert');
const { hashPassword, verifyPassword } = require('../api/_password');

const stored = hashPassword('correcthorsebattery');
assert.ok(stored.includes(':'), 'stored hash should be "salt:hash"');
assert.strictEqual(verifyPassword('correcthorsebattery', stored), true, 'correct password should verify');
assert.strictEqual(verifyPassword('wrongpassword', stored), false, 'wrong password should not verify');

const stored2 = hashPassword('correcthorsebattery');
assert.notStrictEqual(stored, stored2, 'same password hashed twice should produce different salts/output');

console.log('OK: password hashing tests passed');
