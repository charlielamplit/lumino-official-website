function readReleaseSha() {
  return [process.env.VERCEL_GIT_COMMIT_SHA, process.env.RELEASE_SHA]
    .map((value) => String(value || "").trim().toLowerCase())
    .find((value) => /^[0-9a-f]{40}$/.test(value));
}

export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const releaseSha = readReleaseSha();
  if (!releaseSha) {
    response.status(503).json({ ok: false, error: "release_sha_unavailable" });
    return;
  }

  response.status(200).json({
    ok: true,
    releaseSha,
    environment: process.env.VERCEL ? "vercel" : "tencent",
  });
}
