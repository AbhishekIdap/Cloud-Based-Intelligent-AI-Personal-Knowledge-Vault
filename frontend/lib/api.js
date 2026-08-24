const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("lg_token");
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("lg_token", token);
  else window.localStorage.removeItem("lg_token");
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),

  // Uploads directly to S3-compatible storage using a presigned URL, then
  // confirms the row with the backend. Mirrors the two-step flow in
  // backend/src/routes/files.js.
  async uploadFile(file, { collectionId, category, description } = {}) {
    const { key, uploadUrl, publicUrl, suggestedCategory } = await request("/files/upload-url", {
      method: "POST",
      body: { fileName: file.name, contentType: file.type },
    });

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!put.ok) throw new Error("Upload to storage failed");

    const { file: created } = await request("/files", {
      method: "POST",
      body: {
        name: file.name,
        key,
        sizeKb: Math.ceil(file.size / 1024),
        mimeType: file.type,
        collectionId: collectionId || null,
        category: category || undefined,
        description: description || undefined,
      },
    });
    return { file: created, publicUrl, suggestedCategory };
  },

  async createNote({ name, noteContent, collectionId, description }) {
    const { file } = await request("/files", {
      method: "POST",
      body: { name, noteContent, category: "note", collectionId: collectionId || null, description: description || undefined },
    });
    return file;
  },

  // Manually kicks off (or retries) the background AI content summary for
  // a file — used for files uploaded before this feature existed.
  summarizeFile(id) {
    return request(`/files/${id}/summarize`, { method: "POST" });
  },
};

export { API_URL };
