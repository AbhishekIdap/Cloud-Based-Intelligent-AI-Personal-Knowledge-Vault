// Auto-generates a short, searchable description of a file's actual
// CONTENT (not just its name) right after upload, so files.js's search and
// the assistant's search_files tool can match on what's inside a file, not
// only what it's called. This is what makes ten screenshots all named
// "Screenshot 2026-01-28 19283x.png" findable — see CHANGES.md.
//
// Deliberately Gemini-only (not Claude): this runs automatically on every
// upload, and the whole point of the Gemini integration (per SETUP.md) was
// a free, non-expiring path — we don't want a per-upload cost on a paid key
// just to caption files. If GEMINI_API_KEY isn't set, this quietly no-ops
// (ai_summary_status stays 'skipped') and manual descriptions still work.
let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require("@google/genai"));
} catch {
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

// Races a promise against a hard timeout so a slow/stuck API call can never
// hang the background job indefinitely (same complaint as the assistant
// being slow — see gemini.js's per-round timeout for the chat path).
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const TEXT_LIKE = /^text\//;
const SUPPORTED_DOCUMENT_TYPES = new Set(["application/pdf", "text/csv"]);

/** Decides whether/how we can look at this file's actual bytes, based on
 * category + mime type. Video/audio/unrecognized binary formats are
 * deliberately skipped for now — Flash's file understanding for those is
 * unreliable and it isn't worth the extra latency/cost per upload. */
function strategyFor({ category, mimeType }) {
  const type = (mimeType || "").toLowerCase();
  if (category === "photo" || type.startsWith("image/")) return "image";
  if (SUPPORTED_DOCUMENT_TYPES.has(type)) return "document";
  if (TEXT_LIKE.test(type) || category === "note") return "text";
  return null;
}

const PROMPT =
  "In ONE short sentence (under 30 words), describe what this file actually contains — " +
  "key subject, any visible text/numbers worth remembering, and its likely purpose. " +
  "Be concrete and specific (names, dates, amounts, places) so someone could find this " +
  "file later by searching for those details. No preamble, just the sentence.";

/**
 * Generates a short AI description of a file's content.
 * `getBuffer` is a lazy fn — only called if the strategy actually needs bytes
 * (skips a storage round-trip entirely for unsupported types).
 * Returns the summary string, or null if this file type isn't supported /
 * Gemini isn't configured / the call failed — callers should treat null as
 * "leave ai_summary empty", never as an error to surface to the user.
 */
async function summarizeFile({ name, mimeType, category, noteContent, getBuffer }) {
  if (!isConfigured()) return null;
  const strategy = strategyFor({ category, mimeType });
  if (!strategy && category !== "note") return null;

  const genai = getClient();

  try {
    let input;
    if (category === "note" || strategy === "text") {
      const text = (noteContent || (await safeText(getBuffer)) || "").slice(0, 20000);
      if (!text.trim()) return null;
      input = [
        { type: "text", text: `${PROMPT}\n\nFile name: ${name}\n\nContents:\n${text}` },
      ];
    } else if (strategy === "image") {
      if (!getBuffer) return null;
      const buf = await getBuffer();
      if (!buf || buf.length === 0) return null;
      input = [
        { type: "text", text: `${PROMPT}\n\nFile name: ${name}` },
        { type: "image", data: buf.toString("base64"), mime_type: mimeType || "image/png" },
      ];
    } else if (strategy === "document") {
      if (!getBuffer) return null;
      const buf = await getBuffer();
      if (!buf || buf.length === 0) return null;
      input = [
        { type: "text", text: `${PROMPT}\n\nFile name: ${name}` },
        { type: "document", data: buf.toString("base64"), mime_type: mimeType },
      ];
    } else {
      return null;
    }

    const interaction = await withTimeout(
      genai.interactions.create({
        model: model(),
        input,
        generation_config: { max_output_tokens: 120 },
      }),
      20_000,
      "Gemini summarize"
    );

    const text = (interaction.output_text || "").trim();
    return text || null;
  } catch (err) {
    console.error(`AI summary failed for "${name}":`, err.message);
    return null;
  }
}

async function safeText(getBuffer) {
  if (!getBuffer) return null;
  try {
    const buf = await getBuffer();
    return buf ? buf.toString("utf8") : null;
  } catch {
    return null;
  }
}

module.exports = { isConfigured, summarizeFile };
