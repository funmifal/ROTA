import crypto from 'crypto';

/**
 * Generates a cryptographically secure numeric verification code
 * using Node's crypto.randomBytes(32).
 *
 * Implementation details:
 * - Generates 32 bytes (256 bits) of secure entropy via `crypto.randomBytes(32)`.
 * - Reads a 32-bit unsigned big-endian integer from the entropy buffer.
 * - Applies rejection sampling to eliminate modulo bias.
 * - Strictly does not use Math.random() or crypto.randomInt().
 *
 * @param length Number of digits in the verification code (default: 6)
 * @returns Uniform numeric string padded to length (e.g. '729104')
 */
export function generateSecureVerificationCode(length: number = 6): string {
  const range = Math.pow(10, length);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % range);

  while (true) {
    // Strictly uses crypto.randomBytes(32)
    const buffer = crypto.randomBytes(32);
    const value = buffer.readUInt32BE(0);

    if (value < limit) {
      return (value % range).toString().padStart(length, '0');
    }
  }
}
