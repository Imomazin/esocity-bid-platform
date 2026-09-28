/**
 * Object storage abstraction for product media and documents.
 * Demo mode renders generated, licence-free artwork; production uses Vercel Blob or S3.
 */

export interface StorageProvider {
  readonly name: 'demo' | 'vercel-blob' | 's3'
  /** Public URL for a stored object key, or null when media is generated (demo). */
  publicUrl(key: string): string | null
}

export class DemoStorageProvider implements StorageProvider {
  readonly name = 'demo' as const
  publicUrl(): string | null {
    return null
  }
}

export class CdnStorageProvider implements StorageProvider {
  constructor(
    readonly name: 'vercel-blob' | 's3',
    private readonly baseUrl: string,
  ) {}

  publicUrl(key: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/${key.replace(/^\//, '')}`
  }
}
