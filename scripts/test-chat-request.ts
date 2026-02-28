/**
 * Test simplu: trimite un mesaj la chat API și verifică ce pleacă
 */

async function testChatRequest() {
  console.log('🧪 TEST: Verificare ce pleacă la Gemini\n');

  const testMessage = 'Vreau să solicit informații despre bugetul local';

  console.log('📤 Trimit mesaj la API:', testMessage);
  console.log('🔍 Verifică console-ul serverului pentru DEBUG output...\n');

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testMessage,
        conversationHistory: [], // Prima conversație
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Eroare:', data);
      return;
    }

    console.log('✅ Răspuns primit de la API:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Response (first 300 chars):`);
    console.log(data.response.substring(0, 300) + '...');
    console.log(`\n🔢 Sources: ${data.sources?.length || 0}`);
    console.log(`🔍 Web searches: ${data.webSearches?.length || 0}`);
    console.log(`🤖 Model: ${data.model.split('/').pop()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 VERIFICĂ în terminal-ul serverului pentru:');
    console.log('   [0] Role: user');
    console.log('       Text (first 200 chars): SYSTEM_ROLE: Asistent specializat Legea 544/2001...');
    console.log('       ✅ This is the SYSTEM PROMPT with injection protection\n');

  } catch (error: any) {
    console.error('❌ Eroare fetch:', error.message);
  }
}

testChatRequest();
