/**
 * Global test setup. Unit tests run in demo mode with deterministic, network-free providers.
 * (Vitest sets NODE_ENV=test itself.)
 */
process.env.DEMO_MODE ??= 'true'
