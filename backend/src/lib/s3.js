const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;

/** Builds a collision-proof object key namespaced by user, keeping the
 * original extension so browsers/OSes still show a sensible file type. */
function buildKey(userId, originalName) {
  const ext = (originalName.match(/\.[a-zA-Z0-9]+$/) || [""])[0];
  return `users/${userId}/${uuidv4()}${ext}`;
}

/** A presigned PUT URL the client uploads directly to (bytes never touch
 * our server), plus the key we'll store as files.storage_url once the
 * client confirms the upload succeeded. */
async function getUploadUrl({ userId, fileName, contentType }) {
  const key = buildKey(userId, fileName);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
  const publicUrl = `${(process.env.S3_PUBLIC_BASE_URL || "").replace(/\/$/, "")}/${key}`;
  return { key, uploadUrl, publicUrl };
}

async function getDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 60 * 10 });
}

async function deleteObject(key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Reads an object's bytes straight from the bucket (server-side, not a
 * presigned URL) — used by lib/summarize.js to hand the actual file content
 * to Gemini after upload. Caps how much we pull for very large files since
 * we only need enough to describe the file, not the whole thing. */
async function getObjectBuffer(key, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(command);
  const chunks = [];
  let total = 0;
  for await (const chunk of res.Body) {
    total += chunk.length;
    if (total > maxBytes) break;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function getObjectSize(key) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return res.ContentLength || 0;
}

module.exports = { getUploadUrl, getDownloadUrl, deleteObject, buildKey, getObjectBuffer, getObjectSize };
