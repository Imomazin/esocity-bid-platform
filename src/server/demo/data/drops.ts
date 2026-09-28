import type { RewardTier } from '@/domain/rewards'

/** Recurring Flash Drop windows (wall-clock anchored, like auction series). */
export interface DropSeries {
  key: string
  productSlug: string
  title: string
  subtitle: string
  dropPriceMinor: number
  stock: number
  perCustomerLimit: number
  durationHours: number
  periodHours: number
  offsetHours: number
  minimumTier: RewardTier | null
  membersOnly: boolean
}

export const DROP_SERIES: DropSeries[] = [
  {
    key: 'barista-morning',
    productSlug: 'crema-barista-pro',
    title: 'Barista Pro Morning Drop',
    subtitle: 'Café-quality espresso, a third off for six hours.',
    dropPriceMinor: 44_900,
    stock: 40,
    perCustomerLimit: 1,
    durationHours: 6,
    periodHours: 24,
    offsetHours: 7,
    minimumTier: null,
    membersOnly: true,
  },
  {
    key: 'air-fryer-rush',
    productSlug: 'fennwick-dual-zone-air-fryer',
    title: 'Air Fryer Rush',
    subtitle: 'Our best-selling dual-zone air fryer at its lowest price.',
    dropPriceMinor: 11_900,
    stock: 150,
    perCustomerLimit: 2,
    durationHours: 3,
    periodHours: 8,
    offsetHours: 1,
    minimumTier: null,
    membersOnly: false,
  },
  {
    key: 'nuit-absolue',
    productSlug: 'maison-elan-nuit-absolue-edp-100ml',
    title: 'Nuit Absolue Evening Edit',
    subtitle: 'The signature eau de parfum, limited allocation.',
    dropPriceMinor: 9_900,
    stock: 60,
    perCustomerLimit: 2,
    durationHours: 4,
    periodHours: 12,
    offsetHours: 5,
    minimumTier: null,
    membersOnly: false,
  },
  {
    key: 'console-silver',
    productSlug: 'pulsar-one-s-1tb',
    title: 'Pulsar One S — Silver Access',
    subtitle: 'Early access for Silver members and above.',
    dropPriceMinor: 39_900,
    stock: 25,
    perCustomerLimit: 1,
    durationHours: 2,
    periodHours: 6,
    offsetHours: 3,
    minimumTier: 'SILVER',
    membersOnly: true,
  },
  {
    key: 'aero-runner',
    productSlug: 'stride-lab-aero-runner',
    title: 'Aero Runner Release',
    subtitle: 'Carbon-plated trainers, launch colourway.',
    dropPriceMinor: 9_900,
    stock: 80,
    perCustomerLimit: 2,
    durationHours: 5,
    periodHours: 10,
    offsetHours: 7,
    minimumTier: null,
    membersOnly: false,
  },
  {
    key: 'tempo-gold',
    productSlug: 'tempo-series-9-45mm',
    title: 'Tempo Series 9 — Gold Drop',
    subtitle: 'Reserved for Gold and Platinum members.',
    dropPriceMinor: 29_900,
    stock: 30,
    perCustomerLimit: 1,
    durationHours: 4,
    periodHours: 24,
    offsetHours: 18,
    minimumTier: 'GOLD',
    membersOnly: true,
  },
]
