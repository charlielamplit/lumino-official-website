(function (root, factory) {
  "use strict";
  const schema = factory();
  if (typeof module === "object" && module.exports) module.exports = schema;
  root.LuminoAdvisorSchema = schema;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ANSWER_MODES = Object.freeze(["fixed", "tool_route", "retrieval_model", "fallback"]);
  const CONFIDENCE = Object.freeze(["high", "medium", "low"]);
  const HANDOFF = Object.freeze(["none", "contact", "expert_required"]);

  function validateResponse(value) {
    const errors = [];
    if (!value || typeof value !== "object") return { ok: false, errors: ["response must be an object"] };
    if (typeof value.intent !== "string" || !value.intent) errors.push("intent is required");
    if (!ANSWER_MODES.includes(value.answer_mode)) errors.push("answer_mode is invalid");
    if (typeof value.answer !== "string" || !value.answer.trim()) errors.push("answer is required");
    if (!CONFIDENCE.includes(value.confidence)) errors.push("confidence is invalid");
    if (!Array.isArray(value.service_matches) || value.service_matches.length > 2) errors.push("service_matches must contain at most two items");
    if (!Array.isArray(value.suggested_replies) || value.suggested_replies.length > 5) errors.push("suggested_replies must contain at most five items");
    if (!Array.isArray(value.sources) || value.sources.length > 3) errors.push("sources must contain at most three items");
    if (!Array.isArray(value.links) || value.links.length > 3) errors.push("links must contain at most three items");
    if (!HANDOFF.includes(value.handoff)) errors.push("handoff is invalid");
    return { ok: errors.length === 0, errors };
  }

  return Object.freeze({ ANSWER_MODES, CONFIDENCE, HANDOFF, validateResponse });
});
