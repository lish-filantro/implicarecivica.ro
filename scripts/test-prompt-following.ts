/**
 * Test: Verifică dacă modelul fine-tuned urmează system prompt-ul
 */

import OpenAI from 'openai';
import { MISTRAL_AGENT_INSTRUCTIONS } from '../lib/mistral/constants';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load API key
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder-openai-key') {
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
    const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
    if (apiKeyMatch && apiKeyMatch[1] !== 'placeholder-openai-key') {
      process.env.OPENAI_API_KEY = apiKeyMatch[1];
    }
  } catch (e) {}
}

const FINE_TUNED_MODEL = 'ft:gpt-4o-mini-2024-07-18:personal:civic-v2:D8rtdl56';
const BASE_MODEL = 'gpt-4o-mini'; // For comparison

async function testPromptFollowing() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'placeholder-openai-key') {
    console.error('❌ OPENAI_API_KEY nu este configurat');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log('🧪 TEST: Urmărește modelul fine-tuned system prompt-ul?\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testQuery = "Vreau să solicit informații despre bugetul local de la Primăria Iași";

  // Test cu model FINE-TUNED
  console.log('📦 TEST 1: MODEL FINE-TUNED cu instructions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Query:', testQuery);
  console.log('\nInstructions trimise:');
  console.log(MISTRAL_AGENT_INSTRUCTIONS.substring(0, 300) + '...\n');

  try {
    const response1 = await client.responses.create({
      model: FINE_TUNED_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: testQuery,
      instructions: MISTRAL_AGENT_INSTRUCTIONS,
    });

    const responseText1 = extractResponseText(response1);
    console.log('✅ Response:');
    console.log(responseText1.substring(0, 500));
    console.log('\n📊 Analiză comportament:');

    // Check for specific markers from the prompt
    const markers = {
      'STEP format': /\[STEP:\d\]/.test(responseText1) || /STEP_\d/.test(responseText1),
      'Emoji blocare (⏸)': responseText1.includes('⏸'),
      'Confirmă/verifică': /confirm|verifică/i.test(responseText1),
      'Structură CE/UNDE/CÂND': /CE:|UNDE:|CÂND:/i.test(responseText1),
      'Format definit problemă': /PROBLEMA_DEFINITĂ/.test(responseText1),
    };

    for (const [marker, present] of Object.entries(markers)) {
      console.log(`  ${present ? '✓' : '✗'} ${marker}: ${present ? 'PREZENT' : 'ABSENT'}`);
    }

    // Test 2: Modelul BASE (fără fine-tuning) cu ACELAȘI prompt
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 TEST 2: MODEL BASE (gpt-4o-mini) cu ACELEAȘI instructions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const response2 = await client.responses.create({
      model: BASE_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: testQuery,
      instructions: MISTRAL_AGENT_INSTRUCTIONS,
    });

    const responseText2 = extractResponseText(response2);
    console.log('✅ Response:');
    console.log(responseText2.substring(0, 500));
    console.log('\n📊 Analiză comportament:');

    const markers2 = {
      'STEP format': /\[STEP:\d\]/.test(responseText2) || /STEP_\d/.test(responseText2),
      'Emoji blocare (⏸)': responseText2.includes('⏸'),
      'Confirmă/verifică': /confirm|verifică/i.test(responseText2),
      'Structură CE/UNDE/CÂND': /CE:|UNDE:|CÂND:/i.test(responseText2),
      'Format definit problemă': /PROBLEMA_DEFINITĂ/.test(responseText2),
    };

    for (const [marker, present] of Object.entries(markers2)) {
      console.log(`  ${present ? '✓' : '✗'} ${marker}: ${present ? 'PREZENT' : 'ABSENT'}`);
    }

    // Compare
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 COMPARAȚIE & CONCLUZIE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const fineTunedScore = Object.values(markers).filter(v => v).length;
    const baseScore = Object.values(markers2).filter(v => v).length;

    console.log(`Fine-tuned model: ${fineTunedScore}/5 markers din prompt`);
    console.log(`Base model: ${baseScore}/5 markers din prompt\n`);

    if (fineTunedScore < 3) {
      console.log('⚠️  PROBLEMĂ: Fine-tuned model NU urmează prompt-ul');
      console.log('\n💡 CAUZĂ:');
      console.log('   Fine-tuning-ul a învățat alte pattern-uri care suprascriu');
      console.log('   instructions-urile trimise la runtime.\n');
      console.log('🔧 SOLUȚII:');
      console.log('   1. Folosește BASE model (gpt-4o-mini) pentru chat + păstrează fine-tuned pentru alte task-uri');
      console.log('   2. Re-antrenează modelul cu date care includ exact acest format de prompt');
      console.log('   3. Modifică prompt-ul să fie mai simplu și mai compatibil cu ce a învățat modelul');
      console.log('   4. Folosește modelul base + few-shot examples în loc de fine-tuning');
    } else {
      console.log('✅ Fine-tuned model urmează prompt-ul destul de bine!');
      if (fineTunedScore < baseScore) {
        console.log('⚠️  Dar modelul BASE îl urmează mai fidel.');
      }
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.status === 404) {
      console.error('Model nu a fost găsit. Verifică că există în contul tău OpenAI.');
    }
  }
}

function extractResponseText(response: any): string {
  let text = "";
  if (response.output) {
    for (const output of response.output) {
      if (output.type === 'message') {
        for (const item of output.content || []) {
          if (item.type === 'output_text') {
            text += item.text || '';
          }
        }
      }
    }
  }
  return text;
}

testPromptFollowing();
