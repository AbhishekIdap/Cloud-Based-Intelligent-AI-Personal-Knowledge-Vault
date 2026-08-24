// Free, non-expiring alternative AI backend for the assistant, alongside
// claude.js. Uses Google's Interactions API (@google/genai), which supports
// multi-step function calling the same way the Claude path does — except
// here the model can actually take actions (star, hide, move, delete,
// set reminders), not just answer and point at files. See assistant.js for
// how this plugs into the existing answerQuery() fallback chain.
let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require("@google/genai"));
} catch {
  // Optional dependency: if `npm install` hasn't been run yet, or no key is
  // configured, callers fall back to Claude or the rule-based responder
  // instead of crashing the server.
  GoogleGenAI = null;
}

function isConfigured() {
  return !!(process.env.GEMINI_API_KEY && GoogleGenAI);
}

let client = null;
function getClient() {
  if (!client && isConfigured()) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

function model() {
  return process.env.GEMINI_MODEL || "gemini-3.7-flash";
}

// Races a promise against a hard timeout, so a stalled network hop (flaky
// wifi, Gemini having a slow moment) fails fast into the caller's fallback
// chain (see answerQuery() in routes/assistant.js) instead of leaving the
// user staring at a spinner indefinitely. This was the main suspect behind
// "the AI is taking so much time to answer" — six possible sequential
// round trips with no ceiling on any one of them.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs one full agent turn: sends systemPrompt + userContent with the given
 * tool declarations, executes any function_call steps Gemini returns via
 * executeTool(name, args), feeds the results back, and repeats until Gemini
 * settles on a final text answer (or maxRounds safety cap is hit).
 *
 * Returns { text, actions } — actions is the ordered list of
 * { name, args, result } for every tool call made, so the caller can surface
 * "what I did" (e.g. "starred 2 files") alongside the reply.
 */
async function chatWithTools({ systemPrompt, userContent, tools, executeTool, maxRounds = 6, roundTimeoutMs = 25_000 }) {
  const genai = getClient();
  if (!genai) throw new Error("Gemini API key not configured");

  let interaction = await withTimeout(
    genai.interactions.create({
      model: model(),
      input: userContent,
      system_instruction: systemPrompt,
      tools,
    }),
    roundTimeoutMs,
    "Gemini interaction"
  );

  const actions = [];
  let rounds = 0;
  let calls = (interaction.steps || []).filter((s) => s.type === "function_call");

  while (calls.length > 0 && rounds < maxRounds) {
    rounds++;

    // Gemini can request several tool calls in one round (e.g. "find my tax
    // PDF and star it" -> search_files + set_star). These are independent
    // DB operations, so run them concurrently instead of one-by-one —
    // previously this loop awaited each call in sequence, which meant a
    // multi-tool turn paid the full latency of every call added together.
    const results = await Promise.all(
      calls.map(async (step) => {
        let args = step.arguments;
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }
        let result;
        try {
          result = await executeTool(step.name, args || {});
        } catch (err) {
          result = { error: err.message };
        }
        actions.push({ name: step.name, args: args || {}, result });
        return {
          type: "function_result",
          name: step.name,
          call_id: step.id,
          result: [{ type: "text", text: JSON.stringify(result) }],
        };
      })
    );

    interaction = await withTimeout(
      genai.interactions.create({
        model: model(),
        input: results,
        system_instruction: systemPrompt,
        tools,
        previous_interaction_id: interaction.id,
      }),
      roundTimeoutMs,
      "Gemini interaction"
    );

    calls = (interaction.steps || []).filter((s) => s.type === "function_call");
  }

  return { text: interaction.output_text || "", actions };
}

module.exports = { isConfigured, chatWithTools };
