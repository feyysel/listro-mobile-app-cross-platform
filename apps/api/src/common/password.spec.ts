import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('creates a verifiable scrypt hash', async () => {
    const hash = await hashPassword('StrongPass123!');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    await expect(verifyPassword('StrongPass123!', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password and malformed hashes', async () => {
    const hash = await hashPassword('StrongPass123!');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    await expect(verifyPassword('StrongPass123!', 'not-a-hash')).resolves.toBe(false);
  });
});
