// src/services/llm.service.js
const fetch = require("node-fetch");

const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateJson({ prompt, model = "gpt-4o-mini", temperature = 0.2 }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: "You return valid JSON only. Do not include explanations." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) throw new Error(`LLM error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(raw);
}

module.exports = { generateJson };
