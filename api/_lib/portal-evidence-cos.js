import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function evidenceConfigured(env = process.env) {
  return env.PORTAL_EVIDENCE_UPLOAD_ENABLED === "1"
    && Boolean(env.COS_BUCKET && env.COS_REGION && env.COS_SECRET_ID && env.COS_SECRET_KEY);
}

export function createCosEvidenceStore(env = process.env) {
  if (!evidenceConfigured(env)) {
    const error = new Error("Private evidence storage is not configured");
    error.code = "DEPENDENCY_UNAVAILABLE";
    throw error;
  }
  const COS = require("cos-nodejs-sdk-v5");
  const cos = new COS({ SecretId: env.COS_SECRET_ID, SecretKey: env.COS_SECRET_KEY,
    ...(env.COS_SECURITY_TOKEN ? { SecurityToken: env.COS_SECURITY_TOKEN } : {}) });
  const scope = { Bucket: env.COS_BUCKET, Region: env.COS_REGION };
  return {
    put(key, bytes, mediaType) {
      return new Promise((resolve, reject) => cos.putObject({ ...scope, Key: key, Body: bytes,
        ContentType: mediaType, ContentDisposition: "attachment" }, (error) => error ? reject(error) : resolve()));
    },
    get(key) {
      return new Promise((resolve, reject) => cos.getObject({ ...scope, Key: key }, (error, data) => {
        if (error) return reject(error);
        const body = data?.Body;
        if (Buffer.isBuffer(body)) return resolve(body);
        if (typeof body === "string") return resolve(Buffer.from(body, "binary"));
        reject(new Error("Unexpected COS object body"));
      }));
    },
  };
}
