// Mirrors categorizeFile() from the original LifeGraph.jsx prototype.
// The client can keep doing this same rule-based guess client-side for a
// snappy UI, but this server copy is the source of truth: it runs again on
// upload-confirm and, if it disagrees with the client, wins (category_source
// is set to 'rule_based' either way until real AI categorization is wired
// in — see schema.sql notes at the bottom of the file for the pgvector plan).
function categorizeFile({ name = "", mimeType = "" }) {
  const n = name.toLowerCase();
  const type = mimeType.toLowerCase();

  if (type.startsWith("image/")) return "photo";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "recording";
  if (type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/\.(docx?|rtf|odt|pages)$/.test(n)) return "document";
  if (/\.(txt|md)$/.test(n)) return "note";
  if (/\.(jpe?g|png|gif|heic|webp)$/.test(n)) return "photo";
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(n)) return "video";
  if (/\.(mp3|wav|m4a|aac)$/.test(n)) return "recording";
  return "document";
}

/** Suggests a collection by keyword overlap against collection name +
 * keywords — same heuristic as suggestCollection() in the prototype.
 * Swap for an embedding-similarity (pgvector) lookup later; see schema.sql. */
function suggestCollection(fileName, collections) {
  const name = (fileName || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const c of collections) {
    const terms = [c.name, ...(c.keywords || [])].join(" ").toLowerCase().split(/[\s,]+/).filter(Boolean);
    let score = 0;
    for (const t of terms) {
      if (t.length > 2 && name.includes(t)) score += t.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}

module.exports = { categorizeFile, suggestCollection };
