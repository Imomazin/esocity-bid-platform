import { FlaskConicalIcon } from 'lucide-react'
import Link from 'next/link'

export function DemoBanner() {
  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-center text-[12px] leading-5 sm:px-6">
        <FlaskConicalIcon className="hidden size-3.5 shrink-0 opacity-80 sm:block" aria-hidden />
        <p>
          <span className="font-semibold">Demo environment.</span>{' '}
          <span className="opacity-80">
            Bidders, payments and deliveries are simulated — no real money is used.
          </span>{' '}
          <Link
            href="/how-it-works"
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            How bidding works
          </Link>
        </p>
      </div>
    </div>
  )
}
