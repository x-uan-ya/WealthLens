// Vercel serverless entry point for the WealthLens API.
//
// Vercel routes all /api/* requests here (see vercel.json) and invokes this
// exported Express app as a serverless function. The app itself is unchanged —
// its routes are already prefixed with /api, and it does not call app.listen
// when imported (only when run directly for local dev). OPENAI_API_KEY stays
// server-side; it is read from the Vercel environment at runtime.

import app from '../server/index.js'

export default app
