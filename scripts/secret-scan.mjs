#!/usr/bin/env node
/**
 * Lightweight secret scan for a public repository.
 *
 * Scans every tracked and untracked-but-not-ignored text file for credential patterns, refuses
 * committed .env files, and checks that .env.example leaves every secret empty. Exits non-zero on
 * any finding. Matches are reported by file, line and rule only; the matched value is never
 * printed. Run with `pnpm secret-scan` (also runs in CI).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'

/** Patterns are assembled from parts so this file never matches itself. */
const join = (...parts) => new RegExp(parts.join(''))

const RULES = [
  {
    id: 'private-key',
    pattern: join('-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?', 'PRIVATE KEY-----'),
  },
  { id: 'stripe-secret-key', pattern: join('\\b(?:sk|rk)_(?:live|test)_', '[0-9a-zA-Z]{16,}') },
  { id: 'stripe-webhook-secret', pattern: join('\\bwhsec_', '[0-9a-zA-Z]{16,}') },
  { id: 'aws-access-key', pattern: join('\\b(?:AKIA|ASIA)', '[0-9A-Z]{16}\\b') },
  {
    id: 'github-token',
    pattern: join('\\b(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_', '[0-9A-Za-z_]{40,})'),
  },
  { id: 'slack-token', pattern: join('\\bxox[abprs]-', '[0-9A-Za-z-]{10,}') },
  { id: 'google-api-key', pattern: join('\\bAIza', '[0-9A-Za-z_-]{35}\\b') },
  { id: 'resend-api-key', pattern: join('\\bre_', '[0-9A-Za-z]{8,}_[0-9A-Za-z]{16,}') },
  {
    id: 'jwt',
    pattern: join('\\beyJ[0-9A-Za-z_-]{10,}\\.', 'eyJ[0-9A-Za-z_-]{10,}\\.[0-9A-Za-z_-]{10,}'),
  },
  // A connection string that embeds a password (user:password@host).
  {
    id: 'url-with-password',
    pattern: join(
      '\\b(?:postgres(?:ql)?|mysql|mongodb(?:\\+srv)?|redis|rediss|amqp)://',
      '[^\\s:/@\'"`]+:[^\\s@/\'"`]{3,}@',
    ),
  },
  // KEY=value assignments for secret-looking names in env-style files.
  {
    id: 'env-secret-assignment',
    pattern: join(
      '^\\s*(?:export\\s+)?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\\s*=\\s*',
      '[\'"]?[^\\s\'"#]{8,}',
    ),
    files: /(^|\/)(\.env[^/]*|[^/]*\.(env|sh|ya?ml|toml|ini|properties))$/,
  },
]

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.zip',
  '.gz',
])
const SKIP_FILES = new Set(['pnpm-lock.yaml'])
const MAX_BYTES = 2 * 1024 * 1024

function listFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  )
  return [...new Set(output.split('\0').filter(Boolean))]
}

const findings = []
const report = (file, line, rule) => findings.push(`${file}:${line}  ${rule}`)

const files = listFiles()
for (const file of files) {
  const base = file.split('/').pop()
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') report(file, 0, 'env-file-committed')
  if (SKIP_FILES.has(base) || BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue
  let text
  try {
    if (statSync(file).size > MAX_BYTES) continue
    text = readFileSync(file, 'utf8')
  } catch {
    continue // deleted in the working tree, or unreadable
  }
  const lines = text.split(/\r?\n/)
  for (const rule of RULES) {
    if (rule.files && !rule.files.test(file)) continue
    lines.forEach((content, index) => {
      if (rule.pattern.test(content)) report(file, index + 1, rule.id)
    })
  }
  if (base === '.env.example') {
    lines.forEach((content, index) => {
      const match =
        /^\s*([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL)[A-Z0-9_]*)\s*=\s*(\S+)/.exec(
          content,
        )
      if (match) report(file, index + 1, `env-example-value:${match[1]}`)
    })
  }
}

if (findings.length > 0) {
  console.error(
    `Secret scan failed: ${findings.length} potential secret(s) found. Values are not printed.`,
  )
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    'Remove the value, rotate it if it was real, and use environment variables instead (see .env.example).',
  )
  process.exit(1)
}
console.info(`Secret scan passed: ${files.length} files checked, no credentials found.`)
