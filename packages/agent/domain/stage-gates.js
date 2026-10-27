(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoStageGates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GATES_VERSION = "0.1.0";

  function result(partial) {
    return {
      ok: false,
      blocked: false,
      code: null,
      message: "",
      blockers: [],
      nextAction: "",
      ...partial
    };
  }

  function pass(nextAction) {
    return result({ ok: true, message: "??", nextAction: nextAction || "?????" });
  }

  function fail(code, message, blockers, nextAction) {
    return result({
      ok: false,
      code,
      message,
      blockers: blockers || [message],
      nextAction: nextAction || "????????????"
    });
  }

  const cbamStages = Object.freeze([
    {
      id: "applicability",
      title: "????",
      check(ctx) {
        const decisions = ctx.scopeDecisions || [];
        if (!decisions.length) {
          return fail("CBAM_SCOPE_UNDECIDED", "??????????", ["????????"], "????????????");
        }
        const open = decisions.filter((item) => !item.status || item.status === "OPEN" || item.status === "PENDING");
        if (open.length === decisions.length) {
          return fail("CBAM_SCOPE_UNDECIDED", "?????????", open.map((item) => item.id || "?????"), "????????????");
        }
        return pass("???????");
      }
    },
    {
      id: "scope-codes",
      title: "?????",
      check(ctx) {
        const bindings = ctx.codeBindings || [];
        if (!bindings.length) {
          return fail("CBAM_CODE_PENDING", "?? CN??????????", [], "???????????");
        }
        const pending = bindings.filter((item) => item.status !== "CONFIRMED");
        if (pending.length) {
          return fail(
            "CBAM_CODE_PENDING",
            "????????????",
            pending.map((item) => item.id || item.cnCode || "?????"),
            "?? CN????????"
          );
        }
        return pass("??????");
      }
    },
    {
      id: "data-prep",
      title: "????",
      check(ctx) {
        const bindings = ctx.activityBindings || [];
        if (!bindings.length) {
          return fail("CBAM_DATA_INCOMPLETE", "??????????", [], "???????????");
        }
        const conflicted = bindings.filter((item) => item.status === "CONFLICTED" || item.conflicted);
        if (conflicted.length) {
          return fail(
            "CBAM_DATA_INCOMPLETE",
            "?????????",
            conflicted.map((item) => item.id || "????"),
            "??????????"
          );
        }
        const pending = bindings.filter((item) => item.status !== "CONFIRMED");
        if (pending.length) {
          return fail(
            "CBAM_DATA_INCOMPLETE",
            "????????????",
            pending.map((item) => item.id || "?????"),
            "????????????"
          );
        }
        return pass("????");
      }
    },
    {
      id: "calculation",
      title: "??",
      check(ctx) {
        const calc = ctx.calculation || {};
        if (!calc.currentRun) {
          return fail("CBAM_CALC_STALE", "???????????", [], "?????????");
        }
        if (calc.snapshotStatus === "STALE") {
          return fail("CBAM_CALC_STALE", "??????????????????", ["snapshotStatus=STALE"], "???????????");
        }
        return pass("??????");
      }
    },
    {
      id: "verification",
      title: "????",
      check(ctx) {
        const findings = ctx.findings || [];
        const open = findings.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status));
        if (open.length) {
          return fail(
            "CBAM_FINDING_OPEN",
            "??????????",
            open.map((item) => item.id || item.title || "?? Finding"),
            "??????? Finding"
          );
        }
        return pass("???????");
      }
    },
    {
      id: "importer-delivery",
      title: "?????",
      check(ctx) {
        const status = (ctx.delivery && ctx.delivery.status) || "";
        if (!["LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED"].includes(status)) {
          return fail(
            "CBAM_DELIVERY_UNLOCKED",
            "??????????",
            [status ? `???? ${status}` : "??????"],
            "???????????"
          );
        }
        return pass("?????????");
      }
    }
  ]);

  const pcfStages = Object.freeze([
    {
      id: "declaration",
      title: "?????????",
      check(ctx) {
        const decl = ctx.declaration || {};
        if (!decl.functionalUnit || !decl.period || !decl.confirmed) {
          return fail(
            "PCF_DECL_MISSING",
            "???????????",
            [
              !decl.functionalUnit ? "??????" : null,
              !decl.period ? "??????" : null,
              !decl.confirmed ? "?????" : null
            ].filter(Boolean),
            "???????????"
          );
        }
        return pass("??????");
      }
    },
    {
      id: "boundary",
      title: "????",
      check(ctx) {
        const boundary = ctx.boundary || {};
        if (boundary.status !== "CONFIRMED") {
          return fail("PCF_BOUNDARY_UNCONFIRMED", "????????", [boundary.status || "??????"], "??????????");
        }
        return pass("?????????");
      }
    },
    {
      id: "template",
      title: "???????",
      check(ctx) {
        const template = ctx.template || {};
        if (template.status !== "VALIDATED") {
          return fail(
            "PCF_TEMPLATE_INVALID",
            "??????????????",
            [template.status || "??????"],
            "????????????????"
          );
        }
        return pass("????????");
      }
    },
    {
      id: "inventory",
      title: "???????????",
      check(ctx) {
        const bindings = ctx.inventoryBindings || [];
        if (!bindings.length) {
          return fail("PCF_INVENTORY_GAP", "??????????", [], "?????????");
        }
        const pending = bindings.filter((item) => item.status !== "CONFIRMED");
        if (pending.length) {
          return fail(
            "PCF_INVENTORY_GAP",
            "??????????",
            pending.map((item) => item.id || "??????"),
            "????????"
          );
        }
        return pass("?????????");
      }
    },
    {
      id: "factors",
      title: "???????",
      check(ctx) {
        const factors = ctx.factors || [];
        if (!factors.length) {
          return fail("PCF_FACTOR_UNCONFIRMED", "????????", [], "??????????");
        }
        const pending = factors.filter((item) => !item.applicabilityConfirmed);
        if (pending.length) {
          return fail(
            "PCF_FACTOR_UNCONFIRMED",
            "?????????????",
            pending.map((item) => item.id || item.datasetId || "?????"),
            "??????????????"
          );
        }
        return pass("???????");
      }
    },
    {
      id: "calc-hotspot",
      title: "?????",
      check(ctx) {
        const calc = ctx.calculation || {};
        if (!calc.currentRun) {
          return fail("PCF_CALC_STALE", "????????? Run", [], "???????????");
        }
        if (calc.snapshotStatus === "STALE") {
          return fail("PCF_CALC_STALE", "???????", ["snapshotStatus=STALE"], "?????????");
        }
        return pass("???????");
      }
    },
    {
      id: "review-report",
      title: "???????",
      check(ctx) {
        const review = ctx.review || {};
        if (!review.expertApproved || !review.reportVersion) {
          return fail(
            "PCF_REVIEW_PENDING",
            "??????????????",
            [
              !review.expertApproved ? "???????" : null,
              !review.reportVersion ? "??????" : null
            ].filter(Boolean),
            "?????????????"
          );
        }
        return pass("???????");
      }
    }
  ]);

  const catalogs = Object.freeze({
    cbam: cbamStages,
    pcf: pcfStages
  });

  function listStages(serviceId) {
    const stages = catalogs[serviceId];
    if (!stages) throw Object.assign(new Error(`???? ${serviceId}`), { code: "UNKNOWN_SERVICE" });
    return stages.map(({ id, title }) => ({ id, title }));
  }

  function evaluateGate(serviceId, stageId, ctx = {}) {
    const stages = catalogs[serviceId];
    if (!stages) return fail("UNKNOWN_SERVICE", `???? ${serviceId}`);
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return fail("UNKNOWN_STAGE", `???? ${stageId}`);
    const evaluated = stage.check(ctx || {});
    return { ...evaluated, serviceId, stageId, title: stage.title };
  }

  function evaluatePipeline(serviceId, ctx = {}) {
    const stages = catalogs[serviceId];
    if (!stages) throw Object.assign(new Error(`???? ${serviceId}`), { code: "UNKNOWN_SERVICE" });
    const results = [];
    let blockedBy = null;
    for (const stage of stages) {
      if (blockedBy) {
        results.push(result({
          ok: false,
          blocked: true,
          serviceId,
          stageId: stage.id,
          title: stage.title,
          code: "STAGE_BLOCKED",
          message: `???????${blockedBy}`,
          blockers: [`??? ${blockedBy}`],
          nextAction: `?? ${blockedBy}`
        }));
        continue;
      }
      const evaluated = evaluateGate(serviceId, stage.id, ctx);
      results.push(evaluated);
      if (!evaluated.ok) blockedBy = stage.title;
    }
    return results;
  }

  return {
    GATES_VERSION,
    listStages,
    evaluateGate,
    evaluatePipeline,
    catalogs: { cbam: cbamStages.map(({ id, title }) => ({ id, title })), pcf: pcfStages.map(({ id, title }) => ({ id, title })) }
  };
});
