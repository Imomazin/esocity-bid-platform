'use client'

import { useState } from 'react'

import type { ArtKey, ArtPalette } from '@/domain/catalog'
import { cn } from '@/lib/utils'

import { ProductMedia } from './product-art'

export function ProductGallery({
  images,
  palette,
  uid,
  label,
  name,
}: {
  images: { alt: string; art: ArtKey; variant: number; url?: string }[]
  palette: ArtPalette
  uid: string
  label?: string
  name: string
}) {
  const [active, setActive] = useState(0)
  const current = images[active] ?? images[0]!
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border">
        <ProductMedia
          art={current.art}
          palette={palette}
          uid={`${uid}-g`}
          variant={current.variant}
          label={label}
          alt={current.alt}
          imageUrl={current.url}
          className="aspect-square sm:aspect-[5/4]"
        />
      </div>
      <div className="grid grid-cols-3 gap-3" role="group" aria-label={`${name} images`}>
        {images.map((image, index) => (
          <button
            key={image.variant}
            type="button"
            onClick={() => setActive(index)}
            aria-pressed={index === active}
            aria-label={`Show ${image.alt}`}
            className={cn(
              'overflow-hidden rounded-2xl border-2 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              index === active
                ? 'border-foreground'
                : 'border-transparent opacity-80 hover:opacity-100',
            )}
          >
            <ProductMedia
              art={image.art}
              palette={palette}
              uid={`${uid}-t`}
              variant={image.variant}
              label={label}
              alt=""
              imageUrl={image.url}
              className="aspect-[4/3]"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
