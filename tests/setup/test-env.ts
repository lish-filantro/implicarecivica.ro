/**
 * Vitest global setup — loads .env.local for real API keys
 */
import { config } from 'dotenv';
import path from 'path';

// Load .env.local from project root
config({ path: path.resolve(__dirname, '../../.env.local') });

// Validate required env vars for integration/e2e tests
const REQUIRED_FOR_INTEGRATION = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MISTRAL_API_KEY',
];

const missing = REQUIRED_FOR_INTEGRATION.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.warn(
    `⚠️  Missing env vars for integration tests: ${missing.join(', ')}\n` +
    `   Unit tests will still run. Set these in .env.local for full test suite.`,
  );
}
