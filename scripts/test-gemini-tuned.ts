/**
 * Test Gemini TUNED model prin Generative AI API (NU Prediction API)
 */

import { VertexAI } from '@google-cloud/vertexai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const GOOGLE_CREDENTIALS_PATH = resolve(__dirname, '../config/google-service-account.json');
const PROJECT_ID = 'gen-lang-client-0086565608';
const LOCATION = 'us-central1';

// Set credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_CREDENTIALS_PATH;

async function listTunedModels() {
  console.log('🔍 LISTARE MODELE TUNED GEMINI\n');

  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      keyFile: GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // List tuned models
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/tuningJobs`;

    console.log('📤 Request la:', url, '\n');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    console.log('✅ Tuning jobs găsite:\n');
    console.log(JSON.stringify(data, null, 2));

    if (data.tuningJobs && data.tuningJobs.length > 0) {
      console.log('\n📋 Tuning Jobs:');
      data.tuningJobs.forEach((job: any, idx: number) => {
        console.log(`\n  ${idx + 1}. ${job.name}`);
        console.log(`     State: ${job.state}`);
        console.log(`     Base model: ${job.baseModel}`);
        if (job.tunedModel) {
          console.log(`     Tuned model: ${job.tunedModel.model}`);
          console.log(`     Endpoint: ${job.tunedModel.endpoint}`);
        }
      });
    }

    return data.tuningJobs || [];
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return [];
  }
}

async function testTunedModel(modelName: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🧪 TEST MODEL TUNED: ${modelName}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });

    console.log('✅ VertexAI client init');
    console.log(`🔍 Accessing model: ${modelName}\n`);

    const model = vertexAI.getGenerativeModel({
      model: modelName,
    });

    const testPrompt = 'Vreau să solicit informații despre bugetul local de la Primăria Iași';
    console.log(`📤 Prompt: "${testPrompt}"\n`);

    const result = await model.generateContent(testPrompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('✅ SUCCES! Răspuns:\n');
    console.log(text);
    console.log('\n🎉 MODELUL FUNCȚIONEAZĂ!\n');

    return { success: true, text };
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\n📋 Details:', error);
    return { success: false };
  }
}

async function tryCommonFormats() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTARE FORMATE COMUNE DE MODEL NAME');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Common patterns for tuned Gemini models
  const modelPatterns = [
    `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/1382392879858581504`,
    `projects/${PROJECT_ID}/locations/${LOCATION}/models/1382392879858581504`,
    `1382392879858581504`,
    `tunedModels/1382392879858581504`,
  ];

  for (const modelName of modelPatterns) {
    console.log(`🧪 Trying: ${modelName}...`);

    const result = await testTunedModel(modelName);

    if (result.success) {
      console.log(`\n✅ FORMAT CORECT GĂSIT: ${modelName}\n`);
      return { success: true, modelName };
    }

    console.log(`   ❌ Nu funcționează\n`);
  }

  return { success: false };
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   TEST GEMINI TUNED MODEL (GENERATIVE AI) ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('📋 Project:', PROJECT_ID);
  console.log('🌍 Location:', LOCATION);
  console.log('🔗 Endpoint ID:', '1382392879858581504\n');

  // Step 1: List tuning jobs to find model name
  console.log('STEP 1: Găsesc modelul tuned...\n');
  const jobs = await listTunedModels();

  if (jobs.length > 0 && jobs[0].tunedModel) {
    const modelName = jobs[0].tunedModel.model;
    console.log(`\n✅ Model găsit: ${modelName}`);
    await testTunedModel(modelName);
  } else {
    console.log('\n⚠️  Nu am găsit tuning jobs. Încerc formate comune...\n');
    const result = await tryCommonFormats();

    if (!result.success) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 INFORMAȚII NECESARE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('Pentru a accesa modelul tuned, am nevoie de EXACT numele modelului.');
      console.log('\n🔍 Găsește-l aici:');
      console.log('   1. https://console.cloud.google.com/vertex-ai/generative/language/tuning');
      console.log(`      ?project=${PROJECT_ID}`);
      console.log('   2. Click pe tuning job-ul tău');
      console.log('   3. Copiază "Model name" sau "Tuned model endpoint"\n');

      console.log('📋 Sau, în Vertex AI Online Prediction:');
      console.log(`   https://console.cloud.google.com/vertex-ai/online-prediction/endpoints/${ENDPOINT_ID}?project=${PROJECT_ID}`);
      console.log('   Verifică "Deployed model" name\n');
    }
  }
}

main().catch(console.error);
