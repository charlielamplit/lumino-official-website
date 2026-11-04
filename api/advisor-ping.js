export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.status(200).end(JSON.stringify({
    ok: true,
    ping: "advisor-ping",
    method: request.method || null,
  }));
}
