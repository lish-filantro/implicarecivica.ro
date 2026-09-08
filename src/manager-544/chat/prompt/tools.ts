/**
 * Tool definitions for the chat model:
 *   - rag_search  (custom, executed locally over the curated institution KB)
 *   - web_search  (Anthropic server-side tool, executed by the API itself)
 */
import type Anthropic from '@anthropic-ai/sdk';

export const RAG_SEARCH_TOOL = 'rag_search';
export const WEB_SEARCH_MAX_USES = 5;

const ragSearchTool: Anthropic.Messages.Tool = {
  name: RAG_SEARCH_TOOL,
  description:
    'Cauta in baza de cunostinte cu 86 de tipuri de institutii publice din Romania (ministere, agentii, primarii, consilii judetene, inspectorate, servicii locale). ' +
    'Returneaza pentru fiecare institutie: atributii, exemple de cereri 544, contact pentru cereri 544, tipar de email/site si, pentru institutiile generice (primarie, ISJ, DSP etc.), cum se formeaza numele concret pentru localitatea/judetul dat. ' +
    'Foloseste-l OBLIGATORIU la STEP_2 pentru a decide cine este responsabil pentru problema descrisa. Formuleaza query-ul cu termeni concreti despre problema (ex: "groapa asfalt strada", "drum judetean", "scoala incalzire", "poluare aer fabrica"), nu cu numele institutiei.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Termeni de cautare in limba romana care descriu problema sau domeniul (ex: "gropi asfalt strada iluminat")',
      },
      top_k: {
        type: 'number',
        description: 'Numar de rezultate (default: 5, max: 10)',
      },
      localitate: {
        type: 'string',
        description: 'Localitatea din problema (ex: "Pitești"), daca e cunoscuta — completeaza tiparele de nume/email',
      },
      judet: {
        type: 'string',
        description: 'Judetul din problema (ex: "Argeș"), daca e cunoscut',
      },
    },
    required: ['query'],
  },
};

// No allowed_domains filter: wildcards (*.ro) are invalid and the system prompt
// already directs the model to official .ro / .gov.ro sites.
const webSearchTool: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: WEB_SEARCH_MAX_USES,
};

export function buildTools(): Anthropic.Messages.ToolUnion[] {
  return [ragSearchTool, webSearchTool];
}
