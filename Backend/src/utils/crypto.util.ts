import crypto from 'crypto';

/**
 * Generates a cryptographically secure, uniform numeric verification code.
 *
 * Implementation details:
 * - Uses Node's `crypto.randomBytes(4)` to extract 32 bits of cryptographically secure entropy.
 * - Reads the buffer as an unsigned 32-bit big-endian integer.
 * - Applies rejection sampling against the highest integer multiple of the range
 *   to eliminate modulo bias completely.
 * - STRICTLY DOES NOT USE Math.random().
 * - STRICTLY DOES NOT USE crypto.randomInt().
 *
 * @param length The number of digits in the verification code (default: 6)
 * @returns Uniform numeric string padded to the specified length (e.g. '048291')
 */
export function generateSecureVerificationCode(length: number = 6): string {
  const range = Math.pow(10, length);
  const maxUint32 = 0xffffffff; // 4,294,967,295
  // Largest multiple of range less than or equal to 2^32 - 1
  const limit = maxUint32 - (maxUint32 % range);

  while (true) {
    const buffer = crypto.randomBytes(4);
    const value = buffer.readUInt32BE(0);

    // Rejection sampling: discard values in the biased remainder zone
    if (value < limit) {
      return (value % range).toString().padStart(length, '0');
    }
  }
}
