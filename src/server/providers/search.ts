import type { Brand, Category, Product } from '@/domain/catalog'

/**
 * Search provider abstraction. The local implementation scores products, brands, categories
 * and auction titles in memory. The interface is shaped so Algolia, Typesense, OpenSearch or a
 * semantic (embedding) index can replace it without touching pages or APIs.
 */

export interface SearchDocument {
  id: string
  kind: 'PRODUCT' | 'AUCTION'
  title: string
  brand: string
  category: string
  subcategory: string
  tags: string[]
  popularity: number
}

export interface SearchHit {
  id: string
  kind: SearchDocument['kind']
  score: number
}

export interface SearchProvider {
  readonly name: 'local' | 'algolia' | 'typesense' | 'opensearch'
  search(query: string, documents: readonly SearchDocument[], limit?: number): SearchHit[]
}

export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9£ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length > 0)
}

/** Levenshtein distance with early exit, for typo tolerance on longer tokens. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length] ?? max + 1
}

function tokenScore(queryToken: string, fieldTokens: string[], weight: number): number {
  let best = 0
  for (const token of fieldTokens) {
    if (token === queryToken) best = Math.max(best, weight)
    else if (token.startsWith(queryToken)) best = Math.max(best, weight * 0.75)
    else if (queryToken.length >= 5 && editDistance(queryToken, token, 1) <= 1)
      best = Math.max(best, weight * 0.55)
  }
  return best
}

export class LocalSearchProvider implements SearchProvider {
  readonly name = 'local' as const

  search(query: string, documents: readonly SearchDocument[], limit = 24): SearchHit[] {
    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) return []
    const hits: SearchHit[] = []
    for (const doc of documents) {
      const fields = {
        title: tokenize(doc.title),
        brand: tokenize(doc.brand),
        category: tokenize(`${doc.category} ${doc.subcategory}`),
        tags: doc.tags.flatMap(tokenize),
      }
      let score = 0
      let matched = 0
      for (const token of queryTokens) {
        const tokenBest = Math.max(
          tokenScore(token, fields.title, 3),
          tokenScore(token, fields.brand, 2.5),
          tokenScore(token, fields.category, 1.8),
          tokenScore(token, fields.tags, 1.2),
        )
        if (tokenBest > 0) matched += 1
        score += tokenBest
      }
      if (matched < queryTokens.length) continue
      if (normalize(doc.title).includes(normalize(query))) score += 2
      score += doc.popularity / 200
      hits.push({ id: doc.id, kind: doc.kind, score })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}

export function productDocument(product: Product, category: Category | undefined): SearchDocument {
  return {
    id: product.id,
    kind: 'PRODUCT',
    title: product.name,
    brand: product.brandName,
    category: category?.name ?? product.categorySlug,
    subcategory: product.subcategory,
    tags: product.tags,
    popularity: product.popularity,
  }
}

export function matchBrands(query: string, brands: readonly Brand[]): Brand[] {
  const q = normalize(query)
  if (!q) return []
  return brands.filter((brand) => normalize(brand.name).includes(q)).slice(0, 5)
}

export function matchCategories(query: string, categories: readonly Category[]): Category[] {
  const q = normalize(query)
  if (!q) return []
  return categories
    .filter((category) =>
      normalize(`${category.name} ${category.subcategories.join(' ')}`).includes(q),
    )
    .slice(0, 5)
}
