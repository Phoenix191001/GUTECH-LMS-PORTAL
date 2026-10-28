const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const ALL = LETTERS + DIGITS + '!@#$%'

/** Uniform random integer in [0, max) using rejection sampling (no modulo bias). */
function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  do crypto.getRandomValues(buf)
  while ((buf[0] ?? 0) >= limit)
  return (buf[0] ?? 0) % max
}

const pick = (chars: string) => chars[randomInt(chars.length)] as string

/**
 * Random temporary password (14 chars, always has a letter and a number, no look-alike
 * characters). Works in the browser and on the server. The user must change it at first login.
 */
export function generateTempPassword(length = 14): string {
  const chars = [pick(LETTERS), pick(DIGITS)]
  while (chars.length < length) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j] as string, chars[i] as string]
  }
  return chars.join('')
}
