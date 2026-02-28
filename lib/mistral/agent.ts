// @ts-nocheck
// NOTE: This file is not currently used in production (OpenAI fine-tuned model is active)
// Kept for future Mistral Agent API integration
import { Mistral } from '@mistralai/mistralai'
import { AGENT_CONFIG, MISTRAL_CHATBOT_MODEL } from './constants'

/**
 * Initialize Mistral client
 */
export function getMistralClient() {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not configured')
  }

  return new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
  })
}

/**
 * Create a new Mistral Agent for Law 544 chatbot
 * This should be run ONCE during setup/deployment
 * The returned agent.id should be saved to MISTRAL_AGENT_ID env variable
 *
 * Usage:
 * ```
 * const agent = await createLaw544Agent()
 * console.log('Save this agent ID:', agent.id)
 * // Add to .env: MISTRAL_AGENT_ID=agent-xyz123
 * ```
 */
export async function createLaw544Agent() {
  const mistral = getMistralClient()

  console.log('Creating Mistral Agent with model:', MISTRAL_CHATBOT_MODEL)

  const agent = await mistral.agents.create({
    name: AGENT_CONFIG.name,
    description: AGENT_CONFIG.description,
    model: AGENT_CONFIG.model,
    instructions: AGENT_CONFIG.instructions,
    tools: AGENT_CONFIG.tools,
    ...AGENT_CONFIG.completion_args,
  })

  console.log('✅ Agent created successfully!')
  console.log('Agent ID:', agent.id)
  console.log('Agent Name:', agent.name)
  console.log('Model:', agent.model)
  console.log('\n📝 Add this to your .env.local:')
  console.log(`MISTRAL_AGENT_ID=${agent.id}`)

  return agent
}

/**
 * Get the configured agent ID from environment
 */
export function getAgentId(): string {
  const agentId = process.env.MISTRAL_AGENT_ID

  if (!agentId) {
    throw new Error(
      'MISTRAL_AGENT_ID is not configured. Run the setup script first: npm run setup:mistral'
    )
  }

  return agentId
}

/**
 * Start a new conversation with the Law 544 agent
 *
 * @param message - User's first message
 * @returns Conversation response with conversation_id
 */
export async function startConversation(message: string) {
  const mistral = getMistralClient()
  const agentId = getAgentId()

  const response = await mistral.agents.complete({
    agentId: agentId,
    messages: [{ role: 'user', content: message }],
  })

  return response
}

/**
 * Continue an existing conversation
 *
 * @param conversationId - Mistral conversation ID
 * @param message - User's message
 * @returns Conversation response
 */
export async function continueConversation(
  conversationId: string,
  message: string
) {
  const mistral = getMistralClient()

  const response = await mistral.agents.stream({
    agentId: conversationId, // In streaming, conversation ID is used as agent ID
    messages: [{ role: 'user', content: message }],
  })

  return response
}

/**
 * Extract text content and web sources from agent response
 *
 * @param response - Mistral agent response
 * @returns Parsed response data
 */
export function parseAgentResponse(response: any) {
  let responseText = ''
  const sources: Array<{
    title: string
    url: string
    description?: string
  }> = []
  const webSearches: string[] = []

  const outputs = response.choices?.[0]?.message?.content || response.outputs || []

  for (const output of outputs) {
    if (output.type === 'message' || output.type === 'message.output') {
      const content = output.content || []

      for (const item of content) {
        if (item.type === 'text') {
          responseText += item.text || item.content || ''
        } else if (item.type === 'tool_reference') {
          sources.push({
            title: item.title || 'Source',
            url: item.url || '',
            description: item.description || item.snippet,
          })
        }
      }
    } else if (output.type === 'tool.execution' && output.name === 'web_search') {
      try {
        const args = JSON.parse(output.arguments || '{}')
        if (args.query) {
          webSearches.push(args.query)
        }
      } catch (e) {
        console.error('Failed to parse web search arguments:', e)
      }
    }
  }

  return {
    content: responseText.trim(),
    sources,
    webSearches,
  }
}

/**
 * Check if agent exists and is accessible
 */
export async function verifyAgent() {
  try {
    const mistral = getMistralClient()
    const agentId = getAgentId()

    // Try to retrieve the agent
    const agent = await mistral.agents.retrieve({ agentId })

    console.log('✅ Agent verified successfully')
    console.log('Agent ID:', agent.id)
    console.log('Agent Name:', agent.name)
    console.log('Model:', agent.model)

    return true
  } catch (error) {
    console.error('❌ Agent verification failed:', error)
    return false
  }
}
