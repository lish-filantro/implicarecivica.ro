/**
 * Test explicit pentru web_search_preview cu modelul fine-tuned
 * Forțăm modelul să caute informații actualizate pe web
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load API key from .env.local
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder-openai-key') {
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
    const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
    if (apiKeyMatch && apiKeyMatch[1] !== 'placeholder-openai-key') {
      process.env.OPENAI_API_KEY = apiKeyMatch[1];
    }
  } catch (e) {
    console.error('❌ Nu pot citi .env.local');
  }
}

const OPENAI_MODEL = 'ft:gpt-4o-mini-2024-07-18:personal:civic-v2:D8rtdl56';

async function testWebSearch() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'placeholder-openai-key') {
    console.error('❌ OPENAI_API_KEY nu este configurat');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log('🧪 TEST: Web Search cu modelul fine-tuned\n');

  try {
    // Test cu o întrebare care NECESITĂ web search pentru date actuale
    const query = "Care este adresa de email oficială a Primăriei Iași pentru cereri conform Legii 544/2001? Caută pe site-ul oficial.";

    console.log('📨 Query:', query);
    console.log('🔍 Web search: ENABLED\n');

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: query,
      instructions: "Ești un asistent care caută pe web informații oficiale despre instituții publice din România. IMPORTANT: Folosește web_search pentru a găsi informații actuale de pe site-urile oficiale ale instituțiilor. Nu inventa informații - caută-le pe web.",
    });

    console.log('✅ Response ID:', response.id);
    console.log('📊 Status:', response.status);
    console.log('🔢 Output items:', response.output?.length || 0);
    console.log('\n📦 DETAILED OUTPUT:\n');

    let webSearchUsed = false;
    let responseText = "";

    if (response.output) {
      for (const output of response.output) {
        console.log(`┌─ Type: ${output.type}`);

        if (output.type === 'web_search_call') {
          webSearchUsed = true;
          const query = output.action?.query || '';
          console.log(`│  🔍 WEB SEARCH DETECTED!`);
          console.log(`│  Query: "${query}"`);
          console.log(`└─────────────────────────────────\n`);
        }

        if (output.type === 'message') {
          const content = output.content || [];
          for (const item of content) {
            if (item.type === 'output_text') {
              responseText = item.text || '';
              console.log(`│  📝 Response Text:`);
              console.log(`│  ${responseText.substring(0, 300)}...`);

              const annotations = item.annotations || [];
              if (annotations.length > 0) {
                console.log(`│  📚 Annotations (${annotations.length}):`);
                annotations.forEach((ann: any, idx: number) => {
                  if (ann.type === 'url_citation') {
                    console.log(`│    ${idx + 1}. ${ann.title}`);
                    console.log(`│       → ${ann.url}`);
                  }
                });
              }
              console.log(`└─────────────────────────────────\n`);
            }
          }
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REZULTAT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (webSearchUsed) {
      console.log('✅ WEB SEARCH FUNCȚIONEAZĂ cu modelul fine-tuned!');
      console.log('   Modelul a folosit tool-ul web_search_preview.');
    } else {
      console.log('⚠️  WEB SEARCH NU A FOST FOLOSIT');
      console.log('   Posibile motive:');
      console.log('   1. Modelul fine-tuned nu suportă web_search_preview');
      console.log('   2. Modelul a decis că nu e nevoie de web search');
      console.log('   3. Fine-tuning-ul a modificat comportamentul de tool usage');
    }

    console.log(`\n   Response length: ${responseText.length} chars`);

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);

    if (error.code === 'invalid_request_error' && error.message?.includes('web_search_preview')) {
      console.error('\n💡 CONFIRMAT: web_search_preview NU este suportat pentru fine-tuned models');
      console.error('   Fine-tuned models nu pot folosi built-in web search.');
      console.error('\n   SOLUȚIE: Trebuie să implementăm web search manual prin function calling.');
    }

    if (error.status === 404 && error.message?.includes('model')) {
      console.error('\n💡 Modelul fine-tuned nu a fost găsit în contul tău OpenAI.');
    }

    console.error('\n📋 Full error:');
    console.error(JSON.stringify(error, null, 2));
  }
}

testWebSearch();
