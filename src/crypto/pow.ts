/**
 * Nook Anti-Bot Proof-of-Work (PoW / Hashcash-style) Module
 * Requires clients to solve a lightweight computational puzzle (~200ms - 1s CPU)
 * before issuing new vault account options or registering.
 */

export interface PoWChallenge {
  challenge: string;
  timestamp: number;
  difficulty: number;
}

export interface PoWSolution {
  challenge: string;
  nonce: string;
}

const DEFAULT_DIFFICULTY = 4; // Requires 4 leading zero hex chars (~65k SHA-256 iterations)

/**
 * Generate a new PoW challenge (used by server or client helper)
 */
export function generatePoWChallenge(difficulty = DEFAULT_DIFFICULTY): PoWChallenge {
  const timestamp = Date.now();
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const challenge = `nook_pow_${timestamp}_${randomHex}`;
  return { challenge, timestamp, difficulty };
}

/**
 * Solve PoW Challenge client-side
 * Finds a numeric nonce string such that SHA-256(challenge + ":" + nonce) starts with required 0s
 */
export async function solvePoWPuzzle(
  challenge: string,
  difficulty = DEFAULT_DIFFICULTY,
  onProgress?: (attempts: number) => void
): Promise<PoWSolution> {
  const encoder = new TextEncoder();
  const targetPrefix = '0'.repeat(difficulty);
  let nonceCounter = 0;

  while (true) {
    const input = `${challenge}:${nonceCounter}`;
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex.startsWith(targetPrefix)) {
      return { challenge, nonce: String(nonceCounter) };
    }

    nonceCounter++;
    if (onProgress && nonceCounter % 5000 === 0) {
      onProgress(nonceCounter);
      // Give main thread a tiny breath if taking longer
      await new Promise(r => setTimeout(r, 0));
    }
  }
}

/**
 * Verify PoW Solution server-side
 */
export async function verifyPoWSolution(
  challenge: string,
  nonce: string,
  difficulty = DEFAULT_DIFFICULTY,
  maxAgeMs = 5 * 60 * 1000 // 5 minutes validity
): Promise<{ valid: boolean; error?: string }> {
  if (!challenge || !nonce) {
    return { valid: false, error: 'Proof-of-Work challenge and nonce are required.' };
  }

  // Verify timestamp embedding in challenge format nook_pow_<timestamp>_<randomHex>
  const parts = challenge.split('_');
  if (parts.length < 4 || parts[0] !== 'nook' || parts[1] !== 'pow') {
    return { valid: false, error: 'Invalid Proof-of-Work challenge format.' };
  }

  const timestamp = parseInt(parts[2], 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > maxAgeMs) {
    return { valid: false, error: 'Proof-of-Work challenge has expired. Please try again.' };
  }

  // Compute hash
  const encoder = new TextEncoder();
  const input = `${challenge}:${nonce}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const targetPrefix = '0'.repeat(difficulty);
  if (!hashHex.startsWith(targetPrefix)) {
    return { valid: false, error: 'Proof-of-Work solution is invalid.' };
  }

  return { valid: true };
}
