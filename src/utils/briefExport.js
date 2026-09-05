// briefExport.js
//
// Builds a clean, self-contained HTML document for an RM brief and triggers a
// print dialog (the browser's "Save as PDF" produces the downloadable file).
// Dependency-free: no PDF library required, works offline.
//
// The brief object shape (from normaliseBrief):
//   { situation, whyItMatters, verifiedEvidence[{label,value,source,snapshot,record}],
//     clientContext, discussionPoints[], uncertainty, clientFriendlySummary, _metadata }

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function evidenceRows(evidence = []) {
  if (!evidence.length) return '<p class="muted">No verified evidence attached.</p>'
  return `
    <table class="evi">
      <thead><tr><th>Claim</th><th>Value</th><th>Source</th><th>Snapshot</th></tr></thead>
      <tbody>
        ${evidence
          .map(
            (e) => `<tr>
              <td>${esc(e.label)}${e.record ? `<div class="rec">${esc(e.record)}</div>` : ''}</td>
              <td>${esc(e.value || '—')}</td>
              <td>${esc(e.source || '—')}</td>
              <td>${esc(e.snapshot || '—')}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

function list(items = []) {
  if (!items.length) return ''
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
}

function section(title, bodyHtml) {
  if (!bodyHtml) return ''
  return `<section><h2>${esc(title)}</h2>${bodyHtml}</section>`
}

// Build the full printable HTML document for a brief.
export function buildBriefPrintHtml(brief, clientName) {
  const generatedBy = brief?._metadata?.source === 'openai' ? 'AI-assisted (OpenAI)' : 'Deterministic (verified data only)'
  const dateStr = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>RM Brief${clientName ? ` — ${esc(clientName)}` : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #16232b; margin: 0; padding: 40px; line-height: 1.55; }
  .doc-head { border-bottom: 2px solid #0d2a3a; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #b3872f; font-family: Arial, sans-serif; }
  h1 { font-size: 24px; margin: 6px 0 4px; }
  .meta { font-size: 12px; color: #6b7a83; font-family: Arial, sans-serif; }
  section { margin-bottom: 20px; page-break-inside: avoid; }
  h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #0d2a3a; font-family: Arial, sans-serif; border-bottom: 1px solid #e6e3dc; padding-bottom: 5px; margin: 0 0 10px; }
  p { margin: 0 0 8px; font-size: 14px; }
  ul { margin: 0; padding-left: 20px; font-size: 14px; }
  li { margin-bottom: 5px; }
  .muted { color: #6b7a83; font-size: 13px; }
  table.evi { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11.5px; }
  table.evi th { text-align: left; background: #f4f2ec; border: 1px solid #e6e3dc; padding: 6px 8px; color: #0d2a3a; }
  table.evi td { border: 1px solid #e6e3dc; padding: 6px 8px; vertical-align: top; }
  .rec { color: #6b7a83; font-size: 10.5px; margin-top: 2px; }
  .uncertainty { background: #fbf7ee; border: 1px solid #ecd9a8; border-radius: 6px; padding: 10px 12px; font-size: 13px; font-family: Arial, sans-serif; }
  .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e6e3dc; font-size: 11px; color: #6b7a83; font-family: Arial, sans-serif; }
  @media print { body { padding: 0; } @page { margin: 18mm; } }
</style>
</head>
<body>
  <div class="doc-head">
    <div class="brand">WealthLens · Private Intelligence</div>
    <h1>RM Brief${clientName ? ` — ${esc(clientName)}` : ''}</h1>
    <div class="meta">Generated ${esc(dateStr)} · ${esc(generatedBy)}</div>
  </div>

  ${section('Situation', brief.situation ? `<p>${esc(brief.situation)}</p>` : '')}
  ${section('Why it matters', brief.whyItMatters ? `<p>${esc(brief.whyItMatters)}</p>` : '')}
  ${section('Verified evidence', evidenceRows(brief.verifiedEvidence))}
  ${section('Client context', brief.clientContext ? `<p>${esc(brief.clientContext)}</p>` : '')}
  ${section('Potential discussion considerations', list(brief.discussionPoints))}
  ${brief.uncertainty ? `<section><div class="uncertainty"><strong>Uncertainty:</strong> ${esc(brief.uncertainty)}</div></section>` : ''}
  ${section('Client-friendly summary', brief.clientFriendlySummary ? `<p>${esc(brief.clientFriendlySummary)}</p>` : '')}

  <div class="footer">
    Decision support only. This brief does not constitute investment advice or a buy/sell
    recommendation. All figures trace to the official source records; the Relationship Manager
    remains responsible for all client-facing judgements.
  </div>
</body>
</html>`
}

// Open a print window with the brief and trigger the print dialog. The user
// chooses "Save as PDF" to download. Returns false if the popup was blocked.
export function downloadBriefPdf(brief, clientName) {
  if (!brief) return false
  const html = buildBriefPrintHtml(brief, clientName)
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  // Give the browser a tick to render before invoking print.
  win.onload = () => {
    win.focus()
    win.print()
  }
  // Fallback if onload doesn't fire (some browsers with document.write).
  setTimeout(() => {
    try { win.focus(); win.print() } catch { /* ignore */ }
  }, 400)
  return true
}
