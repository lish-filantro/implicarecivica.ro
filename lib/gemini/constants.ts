/**
 * Google Vertex AI Gemini Configuration
 * Fine-tuned model for Law 544/2001
 */

import { resolve } from 'path';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERTEX AI CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID || 'gen-lang-client-0086565608';
export const GOOGLE_LOCATION = process.env.GOOGLE_LOCATION || 'us-central1';
export const GOOGLE_ENDPOINT_ID = process.env.GOOGLE_ENDPOINT_ID || '1382392879858581504';
export const GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './config/google-service-account.json';

/**
 * Fine-tuned Gemini model endpoint path
 * Format: projects/{PROJECT_ID}/locations/{LOCATION}/endpoints/{ENDPOINT_ID}
 */
export const GEMINI_TUNED_MODEL = `projects/${GOOGLE_PROJECT_ID}/locations/${GOOGLE_LOCATION}/endpoints/${GOOGLE_ENDPOINT_ID}`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT INSTRUCTIONS (reused from Mistral - same prompt works)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { MISTRAL_AGENT_INSTRUCTIONS } from '../mistral/constants';

/**
 * Gemini uses the same instructions as Mistral
 * The fine-tuned model was trained with this format
 */
export const GEMINI_AGENT_INSTRUCTIONS = MISTRAL_AGENT_INSTRUCTIONS;

/**
 * Generation config for Gemini
 */
export const GEMINI_GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
};

/**
 * Safety settings (disable for internal app)
 */
export const GEMINI_SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT' as const,
    threshold: 'BLOCK_NONE' as const,
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH' as const,
    threshold: 'BLOCK_NONE' as const,
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const,
    threshold: 'BLOCK_NONE' as const,
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const,
    threshold: 'BLOCK_NONE' as const,
  },
];
