import {
  BarChart3Icon,
  BoxesIcon,
  FileSpreadsheetIcon,
  HandshakeIcon,
  PackageCheckIcon,
  PoundSterlingIcon,
  RefreshCwIcon,
  TruckIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContentPage, ProseSection } from '@/components/content/content-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Supplier portal',
  description:
    'Sell through Esocity Bid: list products in the marketplace, live auctions and Flash Drops with transparent reporting.',
  alternates: { canonical: '/supplier' },
}

const CAPABILITIES = [
  {
    icon: FileSpreadsheetIcon,
    title: 'Product feeds',
    text: 'Upload catalogues by CSV or API, with validation and image checks.',
    status: 'Planned',
  },
  {
    icon: RefreshCwIcon,
    title: 'Inventory sync',
    text: 'Keep stock in step with your systems; every change is recorded in the inventory ledger.',
    status: 'Planned',
  },
  {
    icon: TruckIcon,
    title: 'Order routing',
    text: 'Receive orders for drop-ship items with SLAs and tracking upload.',
    status: 'Planned',
  },
  {
    icon: PoundSterlingIcon,
    title: 'Settlements',
    text: 'Clear statements of sales, fees and payouts per period.',
    status: 'Planned',
  },
  {
    icon: BarChart3Icon,
    title: 'Performance',
    text: 'Sell-through, auction demand and returns by product.',
    status: 'Planned',
  },
  {
    icon: PackageCheckIcon,
    title: 'Quality controls',
    text: 'Genuine-product assurance, returns handling and customer feedback.',
    status: 'In place',
  },
]

export default function SupplierPage() {
  return (
    <ContentPage
      eyebrow="For suppliers & brands"
      title="Reach engaged shoppers through live commerce"
      intro="Esocity Bid gives vetted suppliers three routes to market — fixed-price marketplace listings, live auctions and time-limited Flash Drops — backed by transparent reporting."
      aside={
        <Button asChild variant="brand" size="lg">
          <Link href="/support?category=account&subject=Supplier%20partnership%20enquiry">
            <HandshakeIcon /> Register interest
          </Link>
        </Button>
      }
    >
      <section aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Supplier portal roadmap
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          The supplier data model (suppliers, purchase orders, inventory ledger and fulfilment) is
          already in place; the self-service portal is being prepared.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <item.icon className="size-5 text-brand" aria-hidden />
                <Badge variant={item.status === 'In place' ? 'success' : 'neutral'}>
                  {item.status}
                </Badge>
              </div>
              <p className="mt-3 font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <ProseSection id="how" title="How partnerships work">
        <ol>
          <li>
            Tell us about your range and fulfilment model (stocked with Esocity, or drop-ship).
          </li>
          <li>
            We agree commercial terms, product eligibility for auctions and Flash Drops, and service
            levels.
          </li>
          <li>Products are onboarded, quality-checked and scheduled by our merchandising team.</li>
          <li>You receive sales, inventory and settlement reporting for every channel.</li>
        </ol>
        <p className="flex items-center gap-2">
          <BoxesIcon className="size-4 text-muted-foreground" aria-hidden /> Auctions are funded and
          operated by Esocity; suppliers never bid or influence live auctions.
        </p>
      </ProseSection>
    </ContentPage>
  )
}
