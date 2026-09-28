/**
 * Deterministic pseudo-random utilities.
 *
 * Used by demo mode so that every server instance derives the same simulated world from the
 * same seed and wall-clock time. Never use these for security-sensitive randomness.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Mulberry32 PRNG — small, fast and good enough for simulations. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

/** A PRNG seeded from an arbitrary list of key parts. */
export function rngFor(...parts: ReadonlyArray<string | number>): Rng {
  return mulberry32(hashString(parts.join('|')))
}

export function randomInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1))
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Cannot pick from an empty list')
  return items[Math.floor(rng() * items.length)] as T
}

/** Weighted pick; weights must be non-negative and not all zero. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((acc, weight) => acc + weight, 0)
  let target = rng() * total
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i] ?? 0
    if (target < 0) return items[i] as T
  }
  return items[items.length - 1] as T
}

/** Sample from an exponential distribution with the given mean. */
export function exponential(rng: Rng, mean: number): number {
  return -Math.log(1 - rng()) * mean
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i] as T
    copy[i] = copy[j] as T
    copy[j] = tmp
  }
  return copy
}

/**
 * Deterministic UUID-formatted identifier derived from key parts (RFC 4122 layout, version 5
 * nibble, variant bits set). Suitable for stable demo identifiers.
 */
export function deterministicUuid(...parts: ReadonlyArray<string | number>): string {
  const key = parts.join('|')
  const words = [0, 1, 2, 3].map((salt) =>
    hashString(`${salt}:${key}`).toString(16).padStart(8, '0'),
  )
  const hex = words.join('')
  const version = `5${hex.slice(13, 16)}`
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}-${variant}-${hex.slice(20, 32)}`
}
