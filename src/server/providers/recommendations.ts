import type { Product } from '@/domain/catalog'

/**
 * Recommendation provider abstraction. The demo recommender is a transparent heuristic over
 * first-party signals (viewed categories, watchlist, bid history, purchases and popularity) and
 * needs no AI API keys. A learned model or vector recommender can implement the same interface.
 */

export interface RecommendationSignals {
  viewedCategories: string[]
  watchedProductIds: string[]
  watchedCategories: string[]
  biddedCategories: string[]
  purchasedProductIds: string[]
  purchasedBrands: string[]
}

export interface Recommendation {
  productId: string
  score: number
  reason: string
}

export interface RecommendationProvider {
  readonly name: 'heuristic' | 'model'
  recommend(
    products: readonly Product[],
    signals: RecommendationSignals,
    limit?: number,
  ): Recommendation[]
  similar(product: Product, products: readonly Product[], limit?: number): Recommendation[]
}

export class HeuristicRecommender implements RecommendationProvider {
  readonly name = 'heuristic' as const

  recommend(
    products: readonly Product[],
    signals: RecommendationSignals,
    limit = 8,
  ): Recommendation[] {
    const exclude = new Set([...signals.purchasedProductIds, ...signals.watchedProductIds])
    return products
      .filter((product) => product.status === 'ACTIVE' && !exclude.has(product.id))
      .map((product) => {
        let score = product.popularity / 100
        let reason = 'Popular on Esocity Bid'
        if (signals.watchedCategories.includes(product.categorySlug)) {
          score += 1.5
          reason = 'Because you watched similar items'
        }
        if (signals.biddedCategories.includes(product.categorySlug)) {
          score += 1.2
          if (reason === 'Popular on Esocity Bid') reason = 'Based on your bidding'
        }
        if (signals.viewedCategories.includes(product.categorySlug)) {
          score += 0.8
          if (reason === 'Popular on Esocity Bid') reason = 'Based on what you browsed'
        }
        if (signals.purchasedBrands.includes(product.brandSlug)) {
          score += 0.6
          reason = 'From a brand you bought before'
        }
        return { productId: product.id, score, reason }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  similar(product: Product, products: readonly Product[], limit = 6): Recommendation[] {
    return products
      .filter((candidate) => candidate.id !== product.id && candidate.status === 'ACTIVE')
      .map((candidate) => {
        let score = candidate.popularity / 200
        if (candidate.categorySlug === product.categorySlug) score += 1
        if (candidate.subcategory === product.subcategory) score += 1
        if (candidate.brandSlug === product.brandSlug) score += 0.5
        const priceRatio =
          Math.min(candidate.referencePriceMinor, product.referencePriceMinor) /
          Math.max(candidate.referencePriceMinor, product.referencePriceMinor, 1)
        score += priceRatio * 0.5
        return { productId: candidate.id, score, reason: `Similar to ${product.name}` }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
