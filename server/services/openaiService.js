import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateRMBrief(input) {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    instructions: `
You are an AI assistant supporting a private-banking Relationship Manager.

Your role is to help the RM understand why information may matter to a client
and prepare for a client conversation.

Do not provide autonomous investment advice.
Do not tell the client to buy, sell, or hold securities.
Clearly distinguish facts from interpretation.
Use only the client, portfolio, market, and scenario information supplied.
Keep the Relationship Manager responsible for the final judgement.
    `,
    input,
  });

  return response.output_text;
}