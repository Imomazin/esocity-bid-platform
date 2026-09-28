import {
  CarIcon,
  CookingPotIcon,
  DumbbellIcon,
  Gamepad2Icon,
  GiftIcon,
  LuggageIcon,
  ShirtIcon,
  SmartphoneIcon,
  SofaIcon,
  SparkleIcon,
  SparklesIcon,
  WatchIcon,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Smartphone: SmartphoneIcon,
  Gamepad2: Gamepad2Icon,
  Sofa: SofaIcon,
  CookingPot: CookingPotIcon,
  Sparkles: SparklesIcon,
  Shirt: ShirtIcon,
  Watch: WatchIcon,
  Dumbbell: DumbbellIcon,
  Luggage: LuggageIcon,
  Gift: GiftIcon,
  Car: CarIcon,
  Sparkle: SparkleIcon,
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? SparkleIcon
  return <Icon className={className} aria-hidden />
}
