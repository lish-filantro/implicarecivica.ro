/**
 * Test DIRECT la endpoint-ul fine-tuned (skip base models)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GoogleAuth } from 'google-auth-library';

const GOOGLE_CREDENTIALS_PATH = resolve(__dirname, '../config/google-service-account.json');
const PROJECT_ID = 'gen-lang-client-0086565608';
const LOCATION = 'us-central1';
const ENDPOINT_ID = '1382392879858581504';

async function testEndpoint() {
  console.log('🚀 TEST ENDPOINT FINE-TUNED GEMINI\n');
  console.log('📋 Config:');
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Location: ${LOCATION}`);
  console.log(`   Endpoint: ${ENDPOINT_ID}\n`);

  try {
    // Get auth token
    const auth = new GoogleAuth({
      keyFile: GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Access token obtained');
    console.log(`🔑 Token: ${accessToken.substring(0, 30)}...\n`);

    // Endpoint URL
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${ENDPOINT_ID}:predict`;

    console.log('📤 Sending prediction request...');
    console.log(`   URL: ${url}\n`);

    const testPrompt = 'Vreau să solicit informații despre bugetul local de la Primăria Iași';
    console.log(`   Prompt: "${testPrompt}"\n`);

    // Try different payload formats that Vertex AI endpoints might expect
    const payloads = [
      // Format 1: Standard instances
      {
        name: 'Standard instances',
        body: {
          instances: [{ prompt: testPrompt }]
        }
      },
      // Format 2: Content field
      {
        name: 'Content field',
        body: {
          instances: [{ content: testPrompt }]
        }
      },
      // Format 3: Text field
      {
        name: 'Text field',
        body: {
          instances: [{ text: testPrompt }]
        }
      },
      // Format 4: Input field
      {
        name: 'Input field',
        body: {
          instances: [{ input: testPrompt }]
        }
      },
    ];

    for (const payload of payloads) {
      console.log(`🧪 Testing format: ${payload.name}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload.body),
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('\n✅ SUCCESS! Răspuns de la endpoint:\n');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n🎉 FORMAT CORECT:', payload.name);
        console.log('\n💡 Acum configurez chat-ul cu acest format!\n');
        return { success: true, format: payload.name, data };
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Error: ${errorText.substring(0, 200)}...\n`);
      }
    }

    console.log('\n⚠️  Niciun format nu a funcționat. Posibile cauze:');
    console.log('   1. Endpoint-ul nu e deployed (doar saved)');
    console.log('   2. Format-ul de input e diferit (specific modelului tău)');
    console.log('   3. Endpoint ID greșit\n');

    console.log('🔗 Verifică endpoint-ul aici:');
    console.log(`   https://console.cloud.google.com/vertex-ai/online-prediction/endpoints/${ENDPOINT_ID}?project=${PROJECT_ID}\n`);

    console.log('📋 Verifică:');
    console.log('   - Endpoint status: DEPLOYED (nu CREATING sau STOPPED)');
    console.log('   - Sample request din console (copiază format-ul exact)');
    console.log('   - Model type (ce tip de model ai fine-tuned)\n');

    return { success: false };

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\n📋 Full error:');
    console.error(error);
    return { success: false };
  }
}

testEndpoint().then(result => {
  if (!result.success) {
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Check endpoint status în Google Cloud Console');
    console.log('   2. Copy exact input format din "SAMPLE REQUEST"');
    console.log('   3. Sau spune-mi ce model type ai folosit pentru fine-tuning');
    console.log('      (e.g., gemini-1.0-pro, text-bison, etc.)\n');
  }
  process.exit(result.success ? 0 : 1);
});
