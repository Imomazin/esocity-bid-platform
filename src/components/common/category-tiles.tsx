import Link from 'next/link'

import { cn } from '@/lib/utils'

import { CategoryIcon } from './category-icon'

export interface CategoryTile {
  slug: string
  name: string
  icon: string
  tone: string
  productCount: number
  liveAuctions: number
}

export function CategoryTiles({
  categories,
  className,
}: {
  categories: CategoryTile[]
  className?: string
}) {
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)}>
      {categories.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/category/${category.slug}`}
            className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span
              className="art-backdrop flex size-11 items-center justify-center rounded-xl text-foreground"
              style={{ '--art-backdrop': category.tone } as React.CSSProperties}
            >
              <CategoryIcon name={category.icon} className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{category.name}</span>
              <span className="block text-xs text-muted-foreground">
                {category.productCount} products
                {category.liveAuctions ? ` · ${category.liveAuctions} live` : ''}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
