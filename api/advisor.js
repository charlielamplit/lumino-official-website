/**
 * Thin boot wrapper: surface module-load failures as JSON instead of
 * opaque FUNCTION_INVOCATION_FAILED when the implementation fails to import.
 */
export default async function handler(request, response) {
  try {
    const mod = await import("./_lib/advisor-handler.js");
    return await mod.default(request, response);
  } catch (error) {
    const message = String(error?.message || error);
    const stack = String(error?.stack || "").split("\n").slice(0, 12);
    console.error("[lumino-advisor] boot failed", message);
    try {
      response.statusCode = 503;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(JSON.stringify({
        ok: false,
        ui_state: "unavailable",
        degradation_reason: "boot_error",
        answer_mode: "fallback",
        answer: "顾问暂时不可用。请稍后重试，或通过联系页联络 Lumino。",
        error: message,
        stack,
        handoff: "contact",
        links: [{
          type: "contact",
          label: "联系 Lumino",
          url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unavailable",
        }],
      }));
    } catch (nested) {
      console.error("[lumino-advisor] boot response failed", nested?.message || nested);
      throw error;
    }
  }
}
