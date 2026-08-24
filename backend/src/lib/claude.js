let AnthropicSDK = null;
try {
  // Optional dependency: if not installed yet (npm install pending) or no
  // key configured, callers fall back to the rule-based responder instead
  // of crashing the server.
  AnthropicSDK = require("@anthropic-ai/sdk");
} catch {
  AnthropicSDK = null;
}

function isConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY && AnthropicSDK);
}

let client = null;
function getClient() {
  if (!client && isConfigured()) {
    client = new AnthropicSDK.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Same fix as gemini.js's chatWithTools: a hard ceiling so a stalled call
// fails fast into the rule-based fallback (see answerQuery() in
// routes/assistant.js) instead of hanging the request indefinitely.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * messages: [{ role: 'user' | 'assistant', content: string }]
 * Returns the raw text of Claude's reply.
 */
async function chat({ system, messages }) {
  const anthropic = getClient();
  if (!anthropic) throw new Error("Anthropic API key not configured");

  const response = await withTimeout(
    anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 700,
      system,
      messages,
    }),
    25_000,
    "Claude call"
  );

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

module.exports = { isConfigured, chat };
