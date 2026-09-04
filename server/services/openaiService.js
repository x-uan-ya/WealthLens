/**
 * openaiService.js
 *
 * Phase 8: Secure server-side OpenAI integration.
 *
 * GOVERNANCE:
 *   - OPENAI_API_KEY is never exposed to the browser.
 *   - AI receives structured, verified input — no raw portfolio calculations.
 *   - AI responsibilities: explain, contextualise, summarise, identify uncertainty.
 *   - AI must NOT calculate financial figures.
 *   - AI must NOT invent 2026 events.
 *   - AI must NOT make autonomous investment decisions.
 *   - All responses are structured JSON for frontend consumption.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant supporting a private-banking Relationship Manager at Julius Baer.

YOUR ROLE:
- Help the RM understand why specific verified information matters to this particular client.
- Prepare the RM for a client conversation with discussion points.
- Summarise verified evidence clearly.
- Identify client-specific considerations.
- State uncertainty explicitly.

STRICT RULES:
1. Use ONLY the client context, verified metrics, evidence, RM notes, and authoritative events supplied in the input.
2. Do NOT invent facts. Do NOT claim any 2026 event occurred unless it is in the AUTHORITATIVE EVENTS section.
3. Do NOT calculate financial figures — all numbers are pre-calculated and supplied to you.
4. Do NOT make autonomous investment decisions or recommendations.
5. Do NOT tell the client to buy, sell, or hold any security.
6. Clearly distinguish: verified facts vs your interpretation vs uncertainty.
7. Keep the Relationship Manager responsible for all final judgements.
8. If evidence is insufficient for a claim, say so explicitly rather than fabricating context.
9. Do NOT use the phrase "I recommend" or "you should buy/sell/hold".
10. Acknowledge when you are uncertain or when data is limited.

OUTPUT FORMAT:
Respond with valid JSON conforming to this structure:
{
  "summary": "2-3 sentence executive summary of the key situation",
  "whyItMatters": "Explanation of why this matters specifically to this client given their profile, objectives, and circumstances",
  "discussionPoints": ["Point 1", "Point 2", "Point 3"],
  "uncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "evidenceReferences": ["Reference to evidence record 1", "Reference 2"],
  "clientFriendlySummary": "A 1-2 sentence plain-English explanation suitable for a client-facing conversation",
  "rmPreparationNotes": "What the RM should think about before this conversation"
}

Respond ONLY with the JSON object. No preamble, no markdown fences.`

// ─── Generate RM Brief ─────────────────────────────────────────────────────────

/**
 * Generates a structured RM brief from verified intelligence input.
 *
 * @param {object} briefInput - The aiBriefInput object from intelligenceEngine
 * @returns {object} Structured AI brief
 */
export async function generateRMBrief(briefInput) {
  const {
    clientContext,
    verifiedMetrics,
    signals,
    evidence,
    rmNotes,
    authoritativeEvents,
    authoritativeEventContextText,
    scenario,
    uncertainties,
  } = briefInput

  // Build the user message with structured context
  const userMessage = buildUserMessage({
    clientContext,
    verifiedMetrics,
    signals,
    evidence,
    rmNotes,
    authoritativeEvents,
    authoritativeEventContextText,
    scenario,
    uncertainties,
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,  // Low temperature for factual, consistent output
    max_tokens: 1500,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI returned empty response')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('OpenAI response was not valid JSON')
  }

  return {
    ...parsed,
    _metadata: {
      clientId: clientContext?.clientId,
      model: response.model,
      generatedAt: new Date().toISOString(),
      inputSignalCount: signals?.length || 0,
      inputEventCount: authoritativeEvents?.length || 0,
      governanceNote: 'AI-generated explanatory brief. All figures are pre-calculated. AI has not made investment decisions.',
    },
  }
}

// ─── Build User Message ────────────────────────────────────────────────────────

function buildUserMessage({
  clientContext,
  verifiedMetrics,
  signals,
  evidence,
  rmNotes,
  authoritativeEvents,
  authoritativeEventContextText,
  scenario,
  uncertainties,
}) {
  const sections = []

  sections.push('=== CLIENT CONTEXT ===')
  sections.push(JSON.stringify(clientContext, null, 2))

  sections.push('\n=== VERIFIED METRICS (pre-calculated, do not recalculate) ===')
  sections.push(JSON.stringify(verifiedMetrics, null, 2))

  sections.push('\n=== INTELLIGENCE SIGNALS ===')
  sections.push(JSON.stringify(signals, null, 2))

  sections.push('\n=== EVIDENCE ===')
  sections.push(JSON.stringify(evidence?.slice(0, 10), null, 2))  // Cap at 10 evidence items

  if (rmNotes && rmNotes.length > 0) {
    sections.push('\n=== RM NOTES (recent) ===')
    sections.push(JSON.stringify(rmNotes?.slice(0, 5), null, 2))
  }

  if (authoritativeEventContextText) {
    sections.push('\n' + authoritativeEventContextText)
  }

  if (scenario) {
    sections.push('\n=== SCENARIO (stress analysis, NOT a forecast) ===')
    const scenarioSummary = {
      name: scenario.scenarioName,
      knownData: scenario.knownData,
      assumptions: scenario.assumptions,
      calculatedResult: scenario.calculatedStressResult,
      uncertainties: scenario.uncertainty?.items,
    }
    sections.push(JSON.stringify(scenarioSummary, null, 2))
  }

  if (uncertainties && uncertainties.length > 0) {
    sections.push('\n=== KNOWN UNCERTAINTIES ===')
    sections.push(uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n'))
  }

  sections.push('\n=== TASK ===')
  sections.push(
    'Based ONLY on the above verified information, generate the RM brief JSON. ' +
    'Reference specific evidence record IDs where available. ' +
    'Do not reference any 2026 events not in the AUTHORITATIVE EVENTS section.'
  )

  return sections.join('\n')
}

// ─── Legacy compatibility (existing /api/ai/brief endpoint) ───────────────────

/**
 * Backward-compatible function for the existing simple brief endpoint.
 * Takes raw text input and returns text output.
 */
export async function generateRMBriefLegacy(input) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant supporting a private-banking Relationship Manager at Julius Baer.
Your role is to help the RM understand why information may matter to a client and prepare for a client conversation.
Do not provide autonomous investment advice.
Do not tell the client to buy, sell, or hold securities.
Clearly distinguish facts from interpretation.
Use only the client, portfolio, market, and scenario information supplied.
Keep the Relationship Manager responsible for the final judgement.`,
      },
      { role: 'user', content: input },
    ],
    temperature: 0.4,
    max_tokens: 800,
  })
  return response.choices[0]?.message?.content || ''
}
