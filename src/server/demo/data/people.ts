import { rngFor, pick, randomInt } from '@/lib/rng'

/**
 * Names for simulated activity. Simulated bidders use anonymised handles and are always labelled
 * as simulated in the product; they do not represent real people.
 */

export const FIRST_NAMES = [
  'Amara',
  'Oliver',
  'Priya',
  'James',
  'Sofia',
  'Kwame',
  'Emily',
  'Hassan',
  'Chloe',
  'Daniel',
  'Aisha',
  'Tom',
  'Grace',
  'Mohammed',
  'Isla',
  'Ethan',
  'Zara',
  'Lucas',
  'Hannah',
  'Arjun',
  'Freya',
  'Noah',
  'Leah',
  'Jacob',
  'Maya',
  'Samuel',
  'Ruby',
  'Adam',
  'Nia',
  'Harry',
  'Elena',
  'Ravi',
  'Poppy',
  'Kofi',
  'Imogen',
  'Luca',
  'Yasmin',
  'Oscar',
  'Ella',
  'Theo',
  'Anya',
  'Callum',
  'Mei',
  'Jack',
  'Sara',
  'Dylan',
  'Layla',
  'Finn',
  'Esme',
  'Ibrahim',
]

export const LAST_NAMES = [
  'Okafor',
  'Patel',
  'Smith',
  'Khan',
  'Williams',
  'Mensah',
  'Brown',
  'Ahmed',
  'Taylor',
  'Jones',
  'Hughes',
  'Clarke',
  'Singh',
  'Walker',
  'Evans',
  'Thomas',
  'Roberts',
  'Lewis',
  'Wright',
  'Hall',
  'Green',
  'Wood',
  'Turner',
  'Murphy',
  'Campbell',
  'Kowalski',
  'Nguyen',
  'Rossi',
  'Owusu',
  'Ali',
]

export const UK_CITIES = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Glasgow',
  'Bristol',
  'Liverpool',
  'Edinburgh',
  'Cardiff',
  'Belfast',
  'Sheffield',
  'Newcastle',
  'Nottingham',
  'Leicester',
  'Brighton',
  'Southampton',
]

const FRIENDLY_HANDLES = [
  'AlexR',
  'SamW',
  'Priya_K',
  'TomB',
  'NiaJ',
  'Leo88',
  'Mo_T',
  'GraceH',
  'Kai.S',
  'ElleM',
  'Jonno',
  'RaviP',
  'IslaG',
  'DanO',
  'Zed_9',
  'FinnC',
  'Maya_L',
  'OzzyB',
  'Tess.R',
  'BenJ',
]

function maskName(name: string, suffix: string): string {
  return `${name[0]?.toUpperCase() ?? 'X'}***${suffix}`
}

/** A stable pool of anonymised simulated-bidder handles (e.g. "M***a", "J***7", "AlexR"). */
export const SIMULATED_HANDLES: string[] = (() => {
  const rng = rngFor('simulated-handles')
  const handles = new Set<string>(FRIENDLY_HANDLES)
  while (handles.size < 90) {
    const name = pick(rng, FIRST_NAMES)
    const suffix = rng() < 0.45 ? String(randomInt(rng, 1, 9)) : name.slice(-1)
    handles.add(maskName(name, suffix))
  }
  return [...handles]
})()

export function simulatedBidderId(handle: string): string {
  return `sim:${handle}`
}

export function isSimulatedBidderId(id: string): boolean {
  return id.startsWith('sim:')
}

/** Anonymised public handle for a real member (shown to other visitors). */
export function memberHandle(userId: string): string {
  const hex = userId.replace(/-/g, '')
  return `D***${hex.slice(-2).toUpperCase()}`
}
