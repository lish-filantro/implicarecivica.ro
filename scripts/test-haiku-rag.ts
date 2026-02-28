/**
 * Test: Haiku 4.5 + ChromaDB RAG
 *
 * Prerequisites:
 *   pip install chromadb
 *   chroma run --path ./app/chat/chroma_db --port 8000
 *
 * Run:
 *   npx tsx scripts/test-haiku-rag.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('=== Test Haiku 4.5 + ChromaDB RAG ===\n');

  // ── 1. ChromaDB ──
  console.log('1. Verificare ChromaDB...');
  try {
    const { ChromaClient } = await import('chromadb');
    const chroma = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000',
    });

    const collections = await chroma.listCollections();
    console.log(`   OK ChromaDB conectat. Colectii gasit: ${collections.length}`);

    for (const col of collections) {
      const name = typeof col === 'string' ? col : (col as any).name;
      console.log(`\n   Colectie: "${name}"`);

      try {
        const collection = await chroma.getCollection({ name });
        const count = await collection.count();
        console.log(`   Documente: ${count}`);

        if (count > 0) {
          const sample = await collection.query({
            queryTexts: ['Primaria responsabila drumuri locale'],
            nResults: 3,
          });

          console.log('   Sample search "Primaria responsabila drumuri locale":');
          sample.documents[0]?.forEach((doc, i) => {
            const distance = sample.distances?.[0]?.[i]?.toFixed(4) || 'N/A';
            const preview = doc?.substring(0, 120).replace(/\n/g, ' ') || '(gol)';
            console.log(`     ${i + 1}. [dist=${distance}] ${preview}...`);
          });
        }
      } catch (e: any) {
        console.log(`   Nu pot accesa colectia: ${e.message}`);
      }
    }
  } catch (error: any) {
    console.error(`   EROARE: ChromaDB nu ruleaza: ${error.message}`);
    console.log('   Ruleaza: chroma run --path ./app/chat/chroma_db --port 8000');
    console.log('\n   Continuam fara ChromaDB...\n');
  }

  // ── 2. Anthropic API ──
  console.log('\n2. Verificare Anthropic API...');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('   EROARE: ANTHROPIC_API_KEY lipseste din .env.local');
    return;
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const ping = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Raspunde doar cu "OK" daca functionezi.' }],
    });
    const text =
      ping.content[0].type === 'text' ? ping.content[0].text : '(no text)';
    console.log(`   OK Haiku 4.5 raspunde: "${text}"`);
  } catch (error: any) {
    console.error(`   EROARE Anthropic: ${error.message}`);
    return;
  }

  // ── 3. Tool Use test ──
  console.log('\n3. Test tool use (Haiku decide cand sa caute in RAG)...');

  const tools: any[] = [
    {
      name: 'rag_search',
      description:
        'Cauta in baza de cunostinte informatii despre Legea 544/2001 si institutii publice din Romania.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Interogare de cautare in romana',
          },
        },
        required: ['query'],
      },
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system:
      'Esti un asistent specializat pe Legea 544/2001 din Romania. Foloseste tool-ul rag_search cand ai nevoie de informatii despre institutii sau proceduri.',
    tools,
    messages: [
      {
        role: 'user',
        content:
          'Am o groapa pe strada mea de 3 luni. Ce institutie ar trebui sa contactez conform Legii 544?',
      },
    ],
  });

  console.log(`   Stop reason: ${response.stop_reason}`);
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      console.log(
        `   TOOL CALL: ${block.name}(${JSON.stringify(block.input)})`,
      );
    } else if (block.type === 'text') {
      console.log(`   TEXT: ${block.text.substring(0, 200)}...`);
    }
  }

  // ── 4. Test endpoint (if server running) ──
  console.log('\n4. Test endpoint /api/chat-haiku...');
  try {
    const res = await fetch('http://localhost:3000/api/chat-haiku');
    const data = await res.json();
    console.log('   Health check:', JSON.stringify(data, null, 2));
  } catch {
    console.log(
      '   Server nu ruleaza (npm run dev). Health check omis.',
    );
  }

  console.log('\n=== Test complet ===');
}

main().catch(console.error);
