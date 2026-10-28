(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoStageGates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GATES_VERSION = "0.1.2";

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
    return result({ ok: true, message: "通过", nextAction: nextAction || "可进入下一步" });
  }

  function fail(code, message, blockers, nextAction) {
    return result({
      ok: false,
      code: code,
      message: message,
      blockers: blockers || [message],
      nextAction: nextAction || "请先完成当前步骤"
    });
  }

  function hasPeriod(decl) {
    return Boolean(decl.period || (decl.periodStart && decl.periodEnd));
  }

  const cbamStages = Object.freeze([
    {
      id: "applicability",
      title: "适用判断",
      check: function (ctx) {
        const decisions = ctx.scopeDecisions || [];
        if (!decisions.length) {
          return fail("CBAM_SCOPE_UNDECIDED", "尚未建立适用判断", ["缺少范围决定"], "先确认产品与出口是否落入 CBAM");
        }
        const open = decisions.filter(function (item) {
          return !item.status || item.status === "OPEN" || item.status === "PENDING";
        });
        if (open.length === decisions.length) {
          return fail("CBAM_SCOPE_UNDECIDED", "适用判断仍待确认", open.map(function (item) { return item.id || "范围决定"; }), "完成适用判断后再继续");
        }
        return pass("进入商品编码确认");
      }
    },
    {
      id: "scope-codes",
      title: "范围与编码",
      check: function (ctx) {
        const bindings = ctx.codeBindings || [];
        if (!bindings.length) {
          return fail("CBAM_CODE_PENDING", "尚未关联 CN 商品编码", [], "为产品确认 CN 编码");
        }
        const pending = bindings.filter(function (item) { return item.status !== "CONFIRMED"; });
        if (pending.length) {
          return fail("CBAM_CODE_PENDING", "仍有编码待确认", pending.map(function (item) { return item.id || item.cnCode || "编码"; }), "确认全部 CN 编码");
        }
        return pass("进入数据准备");
      }
    },
    {
      id: "data-prep",
      title: "数据准备",
      check: function (ctx) {
        const bindings = ctx.activityBindings || [];
        if (!bindings.length) {
          return fail("CBAM_DATA_INCOMPLETE", "缺少已绑定的活动数据", [], "上传并确认活动数据");
        }
        const conflicted = bindings.filter(function (item) { return item.status === "CONFLICTED" || item.conflicted; });
        if (conflicted.length) {
          return fail("CBAM_DATA_INCOMPLETE", "存在冲突的活动数据", conflicted.map(function (item) { return item.id || "活动数据"; }), "先解决数据冲突");
        }
        const pending = bindings.filter(function (item) { return item.status !== "CONFIRMED"; });
        if (pending.length) {
          return fail("CBAM_DATA_INCOMPLETE", "活动数据尚未全部确认", pending.map(function (item) { return item.id || "活动数据"; }), "确认全部活动数据绑定");
        }
        return pass("进入计算");
      }
    },
    {
      id: "calculation",
      title: "计算",
      check: function (ctx) {
        const calc = ctx.calculation || {};
        if (!calc.currentRun) {
          return fail("CBAM_CALC_STALE", "缺少当前有效计算运行", [], "运行或恢复计算");
        }
        if (calc.snapshotStatus === "STALE") {
          return fail("CBAM_CALC_STALE", "输入快照已过期，需重新计算", ["snapshotStatus=STALE"], "基于最新确认输入重新计算");
        }
        return pass("进入核查支持");
      }
    },
    {
      id: "verification",
      title: "核查支持",
      check: function (ctx) {
        const findings = ctx.findings || [];
        const open = findings.filter(function (item) { return !["RESOLVED", "CLOSED"].includes(item.status); });
        if (open.length) {
          return fail("CBAM_FINDING_OPEN", "仍有未关闭的 Finding", open.map(function (item) { return item.id || "Finding"; }), "处理开放 Finding");
        }
        return pass("进入进口商交付");
      }
    },
    {
      id: "importer-delivery",
      title: "进口商交付",
      check: function (ctx) {
        const delivery = ctx.delivery || {};
        const status = delivery.status;
        if (!["LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(status)) {
          return fail("CBAM_DELIVERY_UNLOCKED", "交付物尚未锁定或交付", [status ? ("当前状态 " + status) : "缺少交付状态"], "完成批准并锁定交付包");
        }
        return pass("本服务主路径完成");
      }
    }
  ]);

  const pcfStages = Object.freeze([
    {
      id: "declaration",
      title: "核算声明与功能单位",
      check: function (ctx) {
        const decl = ctx.declaration || {};
        const blockers = [];
        if (!decl.productId) blockers.push("核算产品");
        if (!decl.goal) blockers.push("核算目标");
        if (!decl.functionalUnit) blockers.push("功能单位");
        if (!hasPeriod(decl)) blockers.push("核算期间");
        if (!decl.confirmed) blockers.push("声明未确认");
        if (blockers.length) {
          return fail("PCF_DECL_MISSING", "核算声明尚未确认完整", blockers, "先确认产品、目标、功能单位与期间");
        }
        return pass("进入系统边界");
      }
    },
    {
      id: "boundary",
      title: "系统边界",
      check: function (ctx) {
        const boundary = ctx.boundary || {};
        const blockers = [];
        if (boundary.status !== "CONFIRMED") blockers.push(boundary.status ? ("状态 " + boundary.status) : "边界未确认");
        if (!boundary.boundaryType) blockers.push("系统边界类型");
        if (!(boundary.includedProcesses && boundary.includedProcesses.length)) blockers.push("纳入过程");
        if (!(boundary.excludedItems && boundary.excludedItems.length)) blockers.push("排除项");
        if (!boundary.cutOffRule) blockers.push("截断规则");
        if (blockers.length) {
          return fail("PCF_BOUNDARY_UNCONFIRMED", "系统边界尚未确认完整", blockers, "确认边界类型、纳入／排除与截断规则");
        }
        return pass("进入模板与清单");
      }
    },
    {
      id: "template",
      title: "模板与结构校验",
      check: function (ctx) {
        const template = ctx.template || {};
        if (template.status !== "VALIDATED") {
          return fail("PCF_TEMPLATE_INVALID", "模板尚未通过结构／单位校验", [template.status || "缺少模板状态"], "回传模板并修复校验错误");
        }
        return pass("进入活动数据确认");
      }
    },
    {
      id: "inventory",
      title: "活动数据与服务绑定",
      check: function (ctx) {
        const bindings = ctx.inventoryBindings || [];
        if (!bindings.length) {
          return fail("PCF_INVENTORY_GAP", "缺少清单绑定", [], "导入或引用活动数据");
        }
        const pending = bindings.filter(function (item) { return item.status !== "CONFIRMED"; });
        if (pending.length) {
          return fail("PCF_INVENTORY_GAP", "活动数据绑定尚未确认", pending.map(function (item) { return item.id || "绑定"; }), "确认服务绑定");
        }
        return pass("进入排放因子");
      }
    },
    {
      id: "factors",
      title: "排放因子适用性",
      check: function (ctx) {
        const factors = ctx.factors || [];
        if (!factors.length) {
          return fail("PCF_FACTOR_UNCONFIRMED", "尚未登记排放因子", [], "选择并确认因子适用性");
        }
        const pending = factors.filter(function (item) { return !item.applicabilityConfirmed; });
        if (pending.length) {
          return fail("PCF_FACTOR_UNCONFIRMED", "排放因子适用性未确认", pending.map(function (item) { return item.id || item.datasetId || "因子"; }), "确认因子版本与适用理由");
        }
        return pass("进入计算");
      }
    },
    {
      id: "calc-hotspot",
      title: "计算与热点",
      check: function (ctx) {
        const calc = ctx.calculation || {};
        if (!calc.currentRun) {
          return fail("PCF_CALC_STALE", "缺少当前有效计算 Run", [], "锁定快照并运行计算");
        }
        if (calc.snapshotStatus === "STALE") {
          return fail("PCF_CALC_STALE", "计算输入已过期", ["snapshotStatus=STALE"], "重新锁定快照并计算");
        }
        return pass("进入复核与报告");
      }
    },
    {
      id: "review-report",
      title: "复核与受控报告",
      check: function (ctx) {
        const review = ctx.review || {};
        if (!review.expertApproved || !review.reportVersion) {
          return fail(
            "PCF_REVIEW_PENDING",
            "报告尚未完成独立复核锁定",
            [
              !review.expertApproved ? "专家复核未通过" : null,
              !review.reportVersion ? "缺少报告版本" : null
            ].filter(Boolean),
            "完成独立复核并锁定报告版本"
          );
        }
        return pass("PCF 主路径完成");
      }
    }
  ]);

  const catalogs = Object.freeze({
    cbam: cbamStages,
    pcf: pcfStages
  });

  function listStages(serviceId) {
    const stages = catalogs[serviceId];
    if (!stages) throw Object.assign(new Error("未知服务 " + serviceId), { code: "UNKNOWN_SERVICE" });
    return stages.map(function (item) { return { id: item.id, title: item.title }; });
  }

  function evaluateGate(serviceId, stageId, ctx) {
    ctx = ctx || {};
    const stages = catalogs[serviceId];
    if (!stages) return fail("UNKNOWN_SERVICE", "未知服务 " + serviceId);
    const stage = stages.find(function (item) { return item.id === stageId; });
    if (!stage) return fail("UNKNOWN_STAGE", "未知阶段 " + stageId);
    const evaluated = stage.check(ctx);
    return Object.assign({}, evaluated, { serviceId: serviceId, stageId: stageId, title: stage.title });
  }

  function evaluatePipeline(serviceId, ctx) {
    ctx = ctx || {};
    const stages = catalogs[serviceId];
    if (!stages) throw Object.assign(new Error("未知服务 " + serviceId), { code: "UNKNOWN_SERVICE" });
    const results = [];
    let blockedBy = null;
    for (let i = 0; i < stages.length; i += 1) {
      const stage = stages[i];
      if (blockedBy) {
        results.push(result({
          ok: false,
          blocked: true,
          serviceId: serviceId,
          stageId: stage.id,
          title: stage.title,
          code: "STAGE_BLOCKED",
          message: "被前置步骤阻塞：" + blockedBy,
          blockers: ["前置步骤 " + blockedBy],
          nextAction: "先完成 " + blockedBy
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
    GATES_VERSION: GATES_VERSION,
    listStages: listStages,
    evaluateGate: evaluateGate,
    evaluatePipeline: evaluatePipeline,
    catalogs: {
      cbam: cbamStages.map(function (item) { return { id: item.id, title: item.title }; }),
      pcf: pcfStages.map(function (item) { return { id: item.id, title: item.title }; })
    }
  };
});
