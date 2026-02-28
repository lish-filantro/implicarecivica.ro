# Mistral AI Setup - Law 544 Chatbot

## 📦 Model Upgrade - COMPLETED ✅

**OLD MODEL** (from PRD):
```
ft:mistral-medium-latest:e09abec0:20251022:5c81d78f
```

**NEW MODEL** (upgraded 2026-02-11):
```
ft:mistral-large-latest:e09abec0:20260211:1e4204af
```

**Changes:**
- ✅ Upgraded from **medium** → **large**
- ✅ New fine-tuning date: 2026-02-11
- ✅ Better performance and accuracy expected

---

## 📁 Files Created/Updated

### New Files:
1. **`lib/mistral/constants.ts`** - Model ID and configurations
2. **`lib/mistral/agent.ts`** - Agent utilities and helper functions
3. **`scripts/setup-mistral-agent.ts`** - Setup script to create agent

### Updated Files:
1. **`package.json`** - Added `setup:mistral` script
2. **`.env.example`** - Added `MISTRAL_AGENT_ID`
3. **`.env.local`** - Updated with new model reference

---

## 🚀 How to Setup the Agent

### Step 1: Install Dependencies (already done ✅)
```bash
npm install @mistralai/mistralai
npm install -D tsx
```

### Step 2: Configure Mistral API Key
Your API key is already in `.env.local`:
```env
MISTRAL_API_KEY=7oVWNHddnvmBuhmecnn1JziwIjY4RB9x
```

### Step 3: Create the Agent
Run the setup script to create a new Mistral Agent with your fine-tuned model:

```bash
npm run setup:mistral
```

**What this does:**
1. Creates a new Mistral Agent with model: `ft:mistral-large-latest:e09abec0:20260211:1e4204af`
2. Configures web search capabilities
3. Sets the Law 544 instructions
4. Returns an **agent ID** that you need to save

**Expected output:**
```
╔════════════════════════════════════════════════════════════╗
║        Mistral Agent Setup - Law 544 Chatbot              ║
╚════════════════════════════════════════════════════════════╝

✅ MISTRAL_API_KEY found
📦 Using model: ft:mistral-large-latest:e09abec0:20260211:1e4204af

Creating agent...

✅ Agent created successfully!
Agent ID: agent-abc123xyz456
Agent Name: Law 544 Assistant
Model: ft:mistral-large-latest:e09abec0:20260211:1e4204af

📝 Add this to your .env.local:
MISTRAL_AGENT_ID=agent-abc123xyz456

╔════════════════════════════════════════════════════════════╗
║                    ✅ SUCCESS!                             ║
╚════════════════════════════════════════════════════════════╝
```

### Step 4: Save Agent ID
Copy the agent ID from the output and add it to `.env.local`:

```env
MISTRAL_AGENT_ID=agent-abc123xyz456  # Replace with your actual ID
```

### Step 5: Restart Dev Server
```bash
# Kill the current server (Ctrl+C)
npm run dev
```

---

## 🎯 How It Works

### Agent-Based Approach (Stateful)

The implementation uses **Mistral Agent API** (Approach A from PRD):

```typescript
// 1. START new conversation
const response = await mistral.agents.complete({
  agentId: process.env.MISTRAL_AGENT_ID,
  messages: [{ role: 'user', content: 'Ce este Legea 544?' }]
})

// Mistral returns conversation_id
const conversationId = response.conversation_id

// Save to database
await supabase.from('chat_conversations').update({
  mistral_conversation_id: conversationId
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2. CONTINUE existing conversation
const followUp = await mistral.agents.stream({
  agentId: conversationId, // Use conversation_id
  messages: [{ role: 'user', content: 'Cum depun o cerere?' }]
})

// Mistral AUTOMATICALLY:
// - Remembers all previous messages
// - Applies agent instructions
// - Uses web search when needed
// - Maintains full context
```

### Key Features:

✅ **Prompt Injection**: Done ONCE when creating agent (no manual injection needed)
✅ **Conversation History**: Managed by Mistral (stateful, automatic)
✅ **Web Search**: Built-in, activated automatically
✅ **Context**: Mistral keeps full history internally
✅ **Cost**: Lower (only send new messages, not full history)

---

## 📝 Constants Reference

All model configurations are in `lib/mistral/constants.ts`:

```typescript
// Chatbot model (NEW)
export const MISTRAL_CHATBOT_MODEL =
  'ft:mistral-large-latest:e09abec0:20260211:1e4204af'

// OCR model (unchanged)
export const MISTRAL_OCR_MODEL = 'mistral-ocr-latest'

// Analysis model (unchanged)
export const MISTRAL_ANALYSIS_MODEL = 'mistral-large-latest'

// Agent instructions
export const MISTRAL_AGENT_INSTRUCTIONS = `...`

// Agent config
export const AGENT_CONFIG = {
  name: 'Law 544 Assistant',
  model: MISTRAL_CHATBOT_MODEL,
  tools: [{ type: 'web_search' }],
  temperature: 0.7,
  // ...
}
```

---

## 🔧 Utility Functions

Available in `lib/mistral/agent.ts`:

```typescript
// Create agent (run once during setup)
const agent = await createLaw544Agent()

// Start new conversation
const response = await startConversation('Ce este Legea 544?')

// Continue conversation
const followUp = await continueConversation(
  conversationId,
  'Cum depun o cerere?'
)

// Parse agent response (extract text + sources)
const { content, sources, webSearches } = parseAgentResponse(response)

// Verify agent exists
const isValid = await verifyAgent()
```

---

## 🚨 Troubleshooting

### Error: "MISTRAL_API_KEY is not configured"
**Solution:** Check `.env.local` has the API key set:
```env
MISTRAL_API_KEY=7oVWNHddnvmBuhmecnn1JziwIjY4RB9x
```

### Error: "MISTRAL_AGENT_ID is not configured"
**Solution:** Run the setup script:
```bash
npm run setup:mistral
```
Then add the returned agent ID to `.env.local`.

### Error: "Agent not found"
**Solution:** Your agent might have been deleted. Run setup again:
```bash
npm run setup:mistral
```

### Error: "Model not found"
**Solution:** Verify your fine-tuned model exists on Mistral platform:
- Go to https://console.mistral.ai/
- Check "Fine-tuned Models"
- Confirm `ft:mistral-large-latest:e09abec0:20260211:1e4204af` exists

---

## 📊 Next Steps

1. ✅ **Model changed** - Done!
2. ⏳ **Create agent** - Run: `npm run setup:mistral`
3. ⏳ **Build chatbot UI** - Create chat pages using this agent
4. ⏳ **Test conversations** - Verify context maintenance and web search

---

## 🔗 References

- PRD Section: "Mistral Agent (Chatbot) Instructions"
- Model ID: `ft:mistral-large-latest:e09abec0:20260211:1e4204af`
- Approach: **A - Mistral Agent (Stateful)**
- Web Search: **Enabled** via `tools: [{ type: 'web_search' }]`
