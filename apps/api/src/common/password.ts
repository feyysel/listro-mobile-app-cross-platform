import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scrypt(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derived) => {
      if (error || !derived) reject(error ?? new Error('Key derivation failed'));
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, salt, KEY_LENGTH, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });

  return timingSafeEqual(actual, expected);
}
