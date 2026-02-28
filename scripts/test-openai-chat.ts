/**
 * Script de test pentru OpenAI Responses API
 *
 * Rulează:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/test-openai-chat.ts
 *
 * Sau citește din .env.local dacă variabila nu e setată
 */

import OpenAI from 'openai';
import { MISTRAL_AGENT_INSTRUCTIONS } from '../lib/mistral/constants';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Try to load API key from .env.local if not in environment
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder-openai-key') {
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
    const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
    if (apiKeyMatch && apiKeyMatch[1] !== 'placeholder-openai-key') {
      process.env.OPENAI_API_KEY = apiKeyMatch[1];
    }
  } catch (e) {
    // .env.local doesn't exist or can't be read
  }
}

const OPENAI_MODEL = 'ft:gpt-4o-mini-2024-07-18:personal:civic-v2:D8rtdl56';

async function testChat() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'placeholder-openai-key') {
    console.error('❌ OPENAI_API_KEY nu este configurat în .env.local');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log('🤖 Testing OpenAI Responses API');
  console.log('📦 Model:', OPENAI_MODEL);
  console.log('🔍 Web Search: ENABLED\n');

  try {
    // Test 1: Prima întrebare (new conversation)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 TEST 1: Prima întrebare');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testMessage = "Vreau să solicit informații despre bugetul local de la Primăria Iași";

    console.log('📨 INPUT:', testMessage);
    console.log('📋 INSTRUCTIONS:', MISTRAL_AGENT_INSTRUCTIONS.substring(0, 200) + '...\n');

    const response1 = await client.responses.create({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: testMessage,
      instructions: MISTRAL_AGENT_INSTRUCTIONS,
    });

    console.log('✅ Response ID:', response1.id);
    console.log('📊 Status:', response1.status);
    console.log('🔢 Output items:', response1.output?.length || 0);
    console.log('\n📦 OUTPUT:');

    // Parse response
    let responseText = "";
    const webSearches: string[] = [];
    const sources: string[] = [];

    if (response1.output) {
      for (const output of response1.output) {
        console.log(`  - Type: ${output.type}`);

        if (output.type === 'web_search_call') {
          const query = output.action?.query || '';
          if (query) {
            webSearches.push(query);
            console.log(`    🔍 Web Search Query: "${query}"`);
          }
        }

        if (output.type === 'message') {
          const content = output.content || [];
          for (const item of content) {
            if (item.type === 'output_text') {
              responseText = item.text || '';
              console.log(`    📝 Text: ${responseText.substring(0, 150)}...`);

              // Check for annotations (URL citations)
              const annotations = item.annotations || [];
              if (annotations.length > 0) {
                console.log(`    📚 Annotations: ${annotations.length}`);
                annotations.forEach((ann: any) => {
                  if (ann.type === 'url_citation') {
                    sources.push(ann.url);
                    console.log(`      → ${ann.title}: ${ann.url}`);
                  }
                });
              }
            }
          }
        }
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`  - Response length: ${responseText.length} chars`);
    console.log(`  - Web searches: ${webSearches.length}`);
    console.log(`  - Sources found: ${sources.length}`);

    // Test 2: Continuare conversație
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 TEST 2: Continuare conversație');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const followUpMessage = "Care este adresa de email?";
    console.log('📨 INPUT:', followUpMessage);
    console.log('🔗 Previous Response ID:', response1.id);

    const response2 = await client.responses.create({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: followUpMessage,
      previous_response_id: response1.id,
    });

    console.log('\n✅ Response ID:', response2.id);
    console.log('📊 Status:', response2.status);

    let responseText2 = "";
    if (response2.output) {
      for (const output of response2.output) {
        if (output.type === 'message') {
          const content = output.content || [];
          for (const item of content) {
            if (item.type === 'output_text') {
              responseText2 = item.text || '';
              console.log(`📝 Response: ${responseText2.substring(0, 200)}...`);
            }
          }
        }
      }
    }

    console.log('\n✅ Test complet cu succes!');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);

    if (error.status === 404 && error.message?.includes('model')) {
      console.error('\n💡 Modelul fine-tuned nu a fost găsit.');
      console.error('   Verifică că modelul există în contul tău OpenAI:');
      console.error('   https://platform.openai.com/finetune');
    }

    if (error.message?.includes('web_search_preview')) {
      console.error('\n💡 Web search nu este suportat pentru acest model.');
      console.error('   Modelele fine-tuned s-ar putea să nu suporte web_search_preview.');
    }

    if (error.status === 401) {
      console.error('\n💡 API Key invalid. Verifică OPENAI_API_KEY în .env.local');
    }

    console.error('\n📋 Full error details:');
    console.error(JSON.stringify(error, null, 2));
  }
}

testChat();
