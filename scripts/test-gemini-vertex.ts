/**
 * Test script pentru Gemini / Vertex AI
 * Verifică conexiunea și listează modele fine-tuned
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';

const API_KEY = 'Ab8RN6L_Zs4nrOPIw2T7WncpQrBXdze57CAffMeBlJEswdr4vw';
const PROJECT_ID = 'gen-lang-client-0086565608';
const LOCATION = 'us-central1';

async function testGoogleAIStudio() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 TEST 1: Google AI Studio (cu API Key)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);

    console.log('✅ Client inițializat cu API key');
    console.log('🔍 Încerc să listez modele...\n');

    // Try to list available models
    // Note: Google AI Studio API might not expose listModels directly
    // Let's try to use a model instead

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('📝 Testez conexiunea cu un prompt simplu...\n');

    const result = await model.generateContent('Hello, respond with just "OK"');
    const response = await result.response;
    const text = response.text();

    console.log('✅ SUCCES! Răspuns primit:', text);
    console.log('\n💡 API Key-ul funcționează cu Google AI Studio!\n');

    // Try to get fine-tuned model
    console.log('🔍 Încerc să accesez un model fine-tuned...');
    console.log('Notă: Google AI Studio folosește format: tunedModels/...\n');

    return true;
  } catch (error: any) {
    console.error('❌ Eroare Google AI Studio:', error.message);
    if (error.message?.includes('API key')) {
      console.error('💡 API Key-ul nu este valid pentru Google AI Studio');
    }
    return false;
  }
}

async function testVertexAI() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 TEST 2: Vertex AI (cu Project ID)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⚠️  NOTĂ: Vertex AI necesită autentificare Service Account');
    console.log('   API Key-ul nu este suficient pentru Vertex AI.\n');

    // Try to initialize with project/location
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    console.log('✅ Client Vertex AI inițializat');
    console.log('📋 Project:', PROJECT_ID);
    console.log('🌍 Location:', LOCATION);
    console.log('\n🔍 Încerc să accesez un model...\n');

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-pro',
    });

    const result = await model.generateContent('Hello, respond with just "OK"');
    const response = await result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('✅ SUCCES! Răspuns primit:', text);
    console.log('\n💡 Vertex AI funcționează cu Application Default Credentials!\n');

    return true;
  } catch (error: any) {
    console.error('❌ Eroare Vertex AI:', error.message);

    if (error.message?.includes('credentials') || error.message?.includes('authentication')) {
      console.error('\n💡 CAUZĂ: Lipsește autentificarea Service Account');
      console.error('\n🔧 SOLUȚIE: Trebuie să configurezi Service Account:');
      console.error('   1. Du-te la: https://console.cloud.google.com/iam-admin/serviceaccounts');
      console.error(`   2. Selectează project: ${PROJECT_ID}`);
      console.error('   3. Creează Service Account sau folosește unul existent');
      console.error('   4. Downloadează JSON key');
      console.error('   5. Salvează JSON-ul în app/config/google-service-account.json');
      console.error('   6. Adaugă în .env.local:');
      console.error('      GOOGLE_APPLICATION_CREDENTIALS=./config/google-service-account.json\n');
    }

    return false;
  }
}

async function listFineTunedModels() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 LISTARE MODELE FINE-TUNED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Pentru a lista modele fine-tuned din Vertex AI, ai nevoie de:');
  console.log('1. Vertex AI Model Garden API enabled');
  console.log('2. Service Account cu permisiuni');
  console.log('3. gcloud CLI sau REST API call\n');

  console.log('🔗 Link către modele tale fine-tuned:');
  console.log(`   https://console.cloud.google.com/vertex-ai/models?project=${PROJECT_ID}\n`);

  console.log('💡 Spune-mi numele modelului fine-tuned din consola Vertex AI');
  console.log('   Format așteptat: "tunedModels/..." sau "publishers/google/models/..."');
}

async function main() {
  console.log('🚀 TESTARE GEMINI / VERTEX AI\n');
  console.log('📋 Configurație:');
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   Location: ${LOCATION}`);
  console.log(`   API Key: ${API_KEY.substring(0, 20)}...\n`);

  const googleAIWorks = await testGoogleAIStudio();
  const vertexAIWorks = await testVertexAI();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 REZUMAT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Google AI Studio: ${googleAIWorks ? '✅ FUNCȚIONEAZĂ' : '❌ NU FUNCȚIONEAZĂ'}`);
  console.log(`Vertex AI: ${vertexAIWorks ? '✅ FUNCȚIONEAZĂ' : '❌ NU FUNCȚIONEAZĂ'}\n`);

  if (googleAIWorks) {
    console.log('💡 Recomandare: Folosește Google AI Studio (mai simplu, API key)');
  } else if (vertexAIWorks) {
    console.log('💡 Recomandare: Folosește Vertex AI (mai robust, production)');
  } else {
    console.log('⚠️  Niciuna nu funcționează. Verifică configurația.\n');
    await listFineTunedModels();
  }
}

main().catch(console.error);
