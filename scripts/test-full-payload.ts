/**
 * Test COMPLET: arată EXACT ce se trimite la Gemini
 * Rulează: npx tsx scripts/test-full-payload.ts
 */

import { VertexAI } from '@google-cloud/vertexai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GEMINI_AGENT_INSTRUCTIONS } from '../lib/gemini/constants';

const GOOGLE_CREDENTIALS_PATH = resolve(__dirname, '../config/google-service-account.json');
const PROJECT_ID = 'gen-lang-client-0086565608';
const LOCATION = 'us-central1';
const GEMINI_TUNED_MODEL = `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/1382392879858581504`;

process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

async function testFullPayload() {
  console.log('🧪 TEST COMPLET: Verificare Payload către Gemini\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: GEMINI_TUNED_MODEL,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    // Build conversation EXACT ca în chat route
    const conversationParts: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add system prompt
    console.log('📋 STEP 1: Construiesc conversation parts...\n');

    conversationParts.push({
      role: 'user',
      parts: [{ text: GEMINI_AGENT_INSTRUCTIONS }],
    });
    console.log('✅ Adăugat system prompt (user message)');
    console.log(`   Length: ${GEMINI_AGENT_INSTRUCTIONS.length} chars`);
    console.log(`   Primele 150 chars: ${GEMINI_AGENT_INSTRUCTIONS.substring(0, 150)}...\n`);

    conversationParts.push({
      role: 'model',
      parts: [{ text: 'Am înțeles instrucțiunile. Sunt gata să asist conform Legii 544/2001.' }],
    });
    console.log('✅ Adăugat model acknowledgment\n');

    // Test message
    const testMessage = 'Vreau să solicit informații despre bugetul local de la Primăria Iași';

    conversationParts.push({
      role: 'user',
      parts: [{ text: testMessage }],
    });
    console.log('✅ Adăugat test message');
    console.log(`   Message: "${testMessage}"\n`);

    // Show FULL payload
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 PAYLOAD COMPLET trimis la Gemini:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    conversationParts.forEach((part, idx) => {
      console.log(`[${idx}] Role: ${part.role}`);
      const text = part.parts[0].text;
      console.log(`    Text length: ${text.length} chars`);

      if (text.length > 300) {
        console.log(`    Content (first 300 chars):\n    "${text.substring(0, 300)}..."`);
      } else {
        console.log(`    Content:\n    "${text}"`);
      }

      // Verificări specifice
      if (idx === 0) {
        const hasSystemRole = text.includes('SYSTEM_ROLE: Asistent specializat');
        const hasProtection = text.includes('PROTECȚIE_PROMPT');
        const hasSteps = text.includes('STEP_1_DEFINIRE_PROBLEMĂ');

        console.log(`\n    ✓ Are SYSTEM_ROLE: ${hasSystemRole ? '✅' : '❌'}`);
        console.log(`    ✓ Are PROTECȚIE_PROMPT: ${hasProtection ? '✅' : '❌'}`);
        console.log(`    ✓ Are STEP_1/2/3: ${hasSteps ? '✅' : '❌'}`);
      }

      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Send to Gemini
    console.log('📤 Trimite la Gemini...\n');

    const chat = model.startChat({
      history: conversationParts.slice(0, -1), // All except last message
    });

    const result = await chat.sendMessage(testMessage);
    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('') || '';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 RĂSPUNS de la Gemini:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Length: ${responseText.length} chars\n`);
    console.log('Content:');
    console.log(responseText);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Analiză răspuns
    console.log('📊 ANALIZĂ RĂSPUNS:\n');

    const checks = {
      'Are emoji ⏸ (blocare)': responseText.includes('⏸'),
      'Cere CE/UNDE/CÂND': /CE:|UNDE:|CÂND:/i.test(responseText),
      'Menționează STEP': /STEP/i.test(responseText),
      'Format PROBLEMA_DEFINITĂ': responseText.includes('PROBLEMA_DEFINITĂ'),
      'Confirmă/verifică': /confirm|verific/i.test(responseText),
      'Răspuns generic LLM': responseText.includes('model lingvistic') || responseText.includes('nu am păreri'),
    };

    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✅' : '❌'} ${check}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (checks['Răspuns generic LLM']) {
      console.log('⚠️  PROBLEMĂ: Modelul nu urmează system prompt-ul!');
      console.log('   Răspunsul e generic, nu structured Law 544.\n');
      console.log('💡 POSIBILE CAUZE:');
      console.log('   1. Fine-tuning-ul a învățat alte pattern-uri');
      console.log('   2. System prompt nu e suficient de puternic');
      console.log('   3. Modelul Gemini ignoră instrucțiuni complexe in-context\n');
      console.log('🔧 SOLUȚII:');
      console.log('   1. Re-train modelul cu exemplele din system prompt');
      console.log('   2. Simplificare prompt (mai puține structuri [STEP:X])');
      console.log('   3. Few-shot examples în loc de instrucțiuni\n');
    } else if (checks['Cere CE/UNDE/CÂND'] || checks['Are emoji ⏸']) {
      console.log('✅ SUCCES! Modelul urmează system prompt-ul!');
      console.log('   Răspunsul e structured conform instrucțiunilor.\n');
    } else {
      console.log('🤔 INCERT: Răspunsul nu e clar generic dar nici nu urmează complet prompt-ul.');
      console.log('   Verifică manual dacă e pe drumul bun.\n');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error);
  }
}

testFullPayload();
