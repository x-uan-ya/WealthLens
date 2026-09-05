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

// Lazy singleton. The client is created only when a brief is actually
// generated — NOT at import time. This keeps the whole server (all the
// deterministic data / intelligence / priority / event endpoints) fully
// operational without an API key. The AI endpoints guard with a 503 when the
// key is absent, so nothing else is blocked by a missing credential.
let _openai = null

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

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

  // If OpenAI is unavailable (no key, network failure, rate limit, timeout, or
  // malformed response) we fall back to a deterministic, template-based brief
  // assembled entirely from the already-verified signals/evidence. It never
  // invents facts or figures — it only re-presents grounded data in the brief
  // structure — so the RM Brief feature always works, even offline.
  let response
  try {
    response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,  // Low temperature for factual, consistent output
      max_tokens: 1500,
    })
  } catch (err) {
    return buildDeterministicBrief(briefInput, `AI unavailable (${err.message})`)
  }

  const raw = response.choices[0]?.message?.content
  if (!raw) return buildDeterministicBrief(briefInput, 'AI returned an empty response')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return buildDeterministicBrief(briefInput, 'AI response was not valid JSON')
  }

  return {
    ...parsed,
    _metadata: {
      clientId: clientContext?.clientId,
      source: 'openai',
      model: response.model,
      generatedAt: new Date().toISOString(),
      inputSignalCount: signals?.length || 0,
      inputEventCount: authoritativeEvents?.length || 0,
      governanceNote: 'AI-generated explanatory brief. All figures are pre-calculated. AI has not made investment decisions.',
    },
  }
}

// ─── Deterministic Fallback Brief (no AI) ───────────────────────────────────────

/**
 * Assembles an RM brief with NO AI, using only the verified inputs. Produced
 * when OpenAI is unavailable so the feature degrades gracefully rather than
 * failing. Governance is preserved by construction: every sentence is built
 * from supplied signals/evidence/events — nothing is generated or inferred, no
 * figures are calculated, no 2026 events are introduced beyond those supplied.
 *
 * Output matches the OpenAI brief shape so the frontend needs no changes.
 *
 * @param {object} briefInput
 * @param {string} reason - why the fallback was used (for metadata/transparency)
 */
export function buildDeterministicBrief(briefInput, reason = 'AI unavailable') {
  const {
    clientContext = {},
    signals = [],
    evidence = [],
    authoritativeEvents = [],
    scenario,
    uncertainties = [],
  } = briefInput || {}

  const name = clientContext.clientName || clientContext.clientId || 'the client'
  const sorted = [...signals].sort((a, b) => sev(b.severity) - sev(a.severity))
  const top = sorted[0]

  // Summary — states what the highest-severity signals are, verbatim titles.
  const summary = sorted.length
    ? `${sorted.length} signal${sorted.length > 1 ? 's have' : ' has'} been identified for ${name}. ` +
      `The most material is: ${top.title}. ${top.summary || ''}`.trim()
    : `No material signals are currently on record for ${name}.`

  // Why it matters — ties each signal to the client's stated objective/context,
  // using only fields already present.
  const objective = clientContext.objectives || clientContext.investmentObjective
  const whyParts = sorted.map((s) => `${s.title} — ${s.summary || 'see verified metrics'}`)
  const whyItMatters =
    (objective ? `Stated objective on record: "${objective}". ` : '') +
    (whyParts.length
      ? `Relative to this, the following are on record: ${whyParts.join('; ')}.`
      : 'No signals to relate to the client objective at this time.')

  // Discussion points — one per signal, framed as a consideration (never advice).
  const discussionPoints = sorted.map(
    (s) => `Review with the client: ${s.title}.`
  )
  if (scenario?.scenarioName) {
    discussionPoints.push(
      `Discuss the ${scenario.scenarioName} stress scenario as a preparation aid — this is not a forecast.`
    )
  }

  // Uncertainties — collected verbatim from signals + explicit input list.
  const signalUncertainties = sorted.flatMap((s) =>
    Array.isArray(s.uncertainty) ? s.uncertainty : s.uncertainty ? [s.uncertainty] : []
  )
  const allUncertainties = [...new Set([...uncertainties, ...signalUncertainties])]
  if (allUncertainties.length === 0) allUncertainties.push('No specific uncertainties recorded.')

  // Evidence references — real source records only.
  const evidenceReferences = evidence
    .map((e) => {
      const rec = e.recordId || (Array.isArray(e.recordIds) ? e.recordIds.join(', ') : null)
      return [e.source, rec].filter(Boolean).join(' · ')
    })
    .filter(Boolean)
  for (const ev of authoritativeEvents) {
    evidenceReferences.push(`event_log.csv · ${ev.eventId} (${ev.title})`)
  }

  const clientFriendlySummary = top
    ? `There is a point worth discussing about your portfolio: ${top.title.toLowerCase()}. Your Relationship Manager will walk you through it.`
    : `Your Relationship Manager will be in touch with any relevant updates.`

  const rmPreparationNotes =
    `Prepared without AI (${reason}). This brief lists the verified signals and their evidence for ${name}. ` +
    `Confirm the figures against the source records before the conversation. The RM remains responsible for all judgements.`

  return {
    summary,
    whyItMatters,
    discussionPoints,
    uncertainties: allUncertainties,
    evidenceReferences,
    clientFriendlySummary,
    rmPreparationNotes,
    _metadata: {
      clientId: clientContext.clientId,
      source: 'deterministic-fallback',
      fallbackReason: reason,
      generatedAt: new Date().toISOString(),
      inputSignalCount: signals.length,
      inputEventCount: authoritativeEvents.length,
      governanceNote:
        'Deterministic brief assembled from verified data only (no AI). No figures calculated, no events invented, no investment decisions made.',
    },
  }
}

function sev(s) {
  return { high: 3, medium: 2, low: 1 }[(s || '').toLowerCase()] ?? 0
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
  const response = await getOpenAI().chat.completions.create({
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
