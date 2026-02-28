/**
 * Setup script to create Mistral Agent for Law 544 chatbot
 *
 * Usage:
 *   npx tsx scripts/setup-mistral-agent.ts
 *
 * This script will:
 * 1. Create a new Mistral Agent with the fine-tuned model
 * 2. Output the agent ID
 * 3. Instruct you to add it to .env.local
 */

import { createLaw544Agent } from '../lib/mistral/agent'
import { MISTRAL_CHATBOT_MODEL } from '../lib/mistral/constants'

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        Mistral Agent Setup - Law 544 Chatbot              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')

  // Check if MISTRAL_API_KEY is set
  if (!process.env.MISTRAL_API_KEY) {
    console.error('❌ Error: MISTRAL_API_KEY is not set in environment variables')
    console.log('\n📝 Please add to your .env.local:')
    console.log('MISTRAL_API_KEY=your-mistral-api-key-here')
    process.exit(1)
  }

  console.log('✅ MISTRAL_API_KEY found')
  console.log(`📦 Using model: ${MISTRAL_CHATBOT_MODEL}`)
  console.log('')
  console.log('Creating agent...\n')

  try {
    const agent = await createLaw544Agent()

    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║                    ✅ SUCCESS!                             ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('Agent created successfully!')
    console.log('')
    console.log('📋 NEXT STEPS:')
    console.log('1. Copy the agent ID above')
    console.log('2. Add it to your .env.local file:')
    console.log('')
    console.log(`   MISTRAL_AGENT_ID=${agent.id}`)
    console.log('')
    console.log('3. Restart your development server')
    console.log('4. The chatbot will now use the new fine-tuned model!')
    console.log('')
  } catch (error) {
    console.error('\n❌ Error creating agent:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
