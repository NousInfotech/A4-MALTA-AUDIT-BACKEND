// src/services/llm.service.js
const fetch = require("node-fetch");

const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateJson({ prompt, model = "gpt-4.1-mini", temperature = 0.2, max_tokens = null }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

  const requestBody = {
    model,
    temperature,
    messages: [
      { role: "system", content: "You return valid JSON only. Do not include explanations." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  };

  // Add max_tokens only if specified (helps control response time and cost)
  if (max_tokens) {
    requestBody.max_tokens = max_tokens;
  }

  // Log request details
  const promptLength = prompt.length;
  const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate: 1 token ≈ 4 chars
  console.log(`[LLM SERVICE] Prompt size: ${promptLength} chars (~${estimatedTokens} tokens)`);
  console.log(`[LLM SERVICE] Model: ${model}, Temperature: ${temperature}, Max tokens: ${max_tokens || 'unlimited'}`);

  const apiStartTime = Date.now();
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(requestBody)
  });
  const apiEndTime = Date.now();
  const apiDuration = apiEndTime - apiStartTime;

  if (!res.ok) throw new Error(`LLM error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";

  // Log usage stats if available
  if (data.usage) {
    console.log(`[LLM SERVICE] Token usage - Prompt: ${data.usage.prompt_tokens}, Completion: ${data.usage.completion_tokens}, Total: ${data.usage.total_tokens}`);
    console.log(`[LLM SERVICE] API response time: ${apiDuration}ms (${(apiDuration/1000).toFixed(2)}s)`);

    // Check if response was truncated
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.warn(`[LLM SERVICE] WARNING: Response truncated due to max_tokens limit! Increase max_tokens or reduce prompt size.`);
    }
  }

  // Try to parse JSON with better error handling
  try {
    return JSON.parse(raw);
  } catch (parseError) {
    console.error(`[LLM SERVICE] JSON Parse Error:`, parseError.message);
    console.error(`[LLM SERVICE] Raw response (first 500 chars):`, raw.substring(0, 500));
    console.error(`[LLM SERVICE] Raw response (last 500 chars):`, raw.substring(Math.max(0, raw.length - 500)));
    throw new Error(`Failed to parse LLM response as JSON: ${parseError.message}`);
  }
}

module.exports = { generateJson };
