import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

@Injectable()
export class PasswordHasher {
  async hash(password: string) {
    const salt = randomBytes(16);
    const derivedKey = await deriveKey(password, salt);
    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, storedHash: string) {
    const [algorithm, saltText, hashText] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltText || !hashText) return false;

    try {
      const salt = Buffer.from(saltText, 'base64url');
      const expected = Buffer.from(hashText, 'base64url');
      if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
      const actual = await deriveKey(password, salt);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
