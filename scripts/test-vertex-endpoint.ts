/**
 * Test Vertex AI Endpoint cu modelul fine-tuned Gemini
 */

import { VertexAI } from '@google-cloud/vertexai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load credentials from config
const GOOGLE_CREDENTIALS_PATH = resolve(__dirname, '../config/google-service-account.json');
const credentials = JSON.parse(readFileSync(GOOGLE_CREDENTIALS_PATH, 'utf-8'));

const PROJECT_ID = 'gen-lang-client-0086565608';
const LOCATION = 'us-central1';
const ENDPOINT_ID = '1382392879858581504';

async function testVertexAIConnection() {
  console.log('🚀 TESTARE VERTEX AI CU SERVICE ACCOUNT\n');
  console.log('📋 Configurație:');
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   Location: ${LOCATION}`);
  console.log(`   Service Account: ${credentials.client_email}`);
  console.log(`   Credentials: ${GOOGLE_CREDENTIALS_PATH}\n`);

  try {
    // Set environment variable for Google auth
    process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    console.log('✅ Vertex AI client inițializat cu service account');
    console.log('🔍 Testez conexiunea cu un model standard...\n');

    // Test with a standard Gemini model first
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    const prompt = 'Răspunde doar cu "OK" dacă mă înțelegi.';
    console.log(`📤 Prompt: "${prompt}"`);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`📥 Răspuns: "${text}"\n`);
    console.log('✅ SUCCES! Vertex AI funcționează cu service account!\n');

    return true;
  } catch (error: any) {
    console.error('❌ Eroare Vertex AI:', error.message);
    console.error('\n📋 Detalii eroare:');
    console.error(error);
    return false;
  }
}

async function testFineTunedEndpoint() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 TESTARE ENDPOINT FINE-TUNED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`🔗 Endpoint ID: ${ENDPOINT_ID}\n`);

  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

    // For Vertex AI endpoints, we need to use the Prediction API
    // The endpoint format is different from regular model calls

    console.log('💡 NOTĂ: Endpoint-urile Vertex AI folosesc Prediction API');
    console.log('   Nu se pot accesa direct prin SDK-ul VertexAI.getGenerativeModel()');
    console.log('   Trebuie folosit REST API sau aiplatform.PredictionServiceClient\n');

    console.log('🔧 Opțiuni pentru a folosi endpoint-ul:');
    console.log('   1. REST API direct (fetch/axios)');
    console.log('   2. @google-cloud/aiplatform package');
    console.log('   3. gcloud CLI\n');

    console.log('📋 Informații endpoint:');
    console.log(`   URL: https://${LOCATION}-aiplatform.googleapis.com/v1/`);
    console.log(`        projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${ENDPOINT_ID}:predict\n`);

    console.log('💡 Îți implementez integrarea cu REST API în chat route...\n');

    return true;
  } catch (error: any) {
    console.error('❌ Eroare:', error.message);
    return false;
  }
}

async function testEndpointRESTAPI() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 TESTARE ENDPOINT PRIN REST API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

    // Get access token
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      keyFile: GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    console.log('✅ Access token obținut');
    console.log(`🔑 Token: ${accessToken.token?.substring(0, 30)}...\n`);

    // Make prediction request
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${ENDPOINT_ID}:predict`;

    console.log(`📤 Trimit request la endpoint...`);
    console.log(`   URL: ${url}\n`);

    const testPrompt = 'Vreau să solicit informații despre bugetul local de la Primăria Iași';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [
          {
            content: testPrompt,
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Eroare HTTP ${response.status}:`, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ SUCCES! Răspuns de la endpoint:\n');
    console.log(JSON.stringify(data, null, 2));

    return true;
  } catch (error: any) {
    console.error('❌ Eroare REST API:', error.message);
    console.error('\n📋 Detalii:', error);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  VERTEX AI ENDPOINT TEST - GEMINI TUNED   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Test 1: Basic Vertex AI connection
  const basicWorks = await testVertexAIConnection();

  if (!basicWorks) {
    console.error('\n⚠️  Conexiunea de bază la Vertex AI a eșuat.');
    console.error('   Verifică service account și permissions.');
    return;
  }

  // Test 2: Endpoint info
  await testFineTunedEndpoint();

  // Test 3: Actual endpoint call
  console.log('🧪 Testez endpoint-ul cu REST API...\n');
  const endpointWorks = await testEndpointRESTAPI();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 REZUMAT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Vertex AI Basic: ${basicWorks ? '✅ FUNCȚIONEAZĂ' : '❌ NU FUNCȚIONEAZĂ'}`);
  console.log(`Endpoint Fine-tuned: ${endpointWorks ? '✅ FUNCȚIONEAZĂ' : '❌ NU FUNCȚIONEAZĂ'}\n`);

  if (endpointWorks) {
    console.log('🎉 EXCELENT! Endpoint-ul funcționează!');
    console.log('   Acum îl integrez în chat route...\n');
  } else {
    console.log('⚠️  Endpoint-ul nu răspunde. Verifică:');
    console.log('   1. Endpoint ID este corect: 1382392879858581504');
    console.log('   2. Endpoint-ul este deployed (nu doar saved)');
    console.log('   3. Service account are permisiuni pentru Vertex AI');
    console.log(`   4. Check: https://console.cloud.google.com/vertex-ai/online-prediction/endpoints?project=${PROJECT_ID}\n`);
  }
}

main().catch(console.error);
