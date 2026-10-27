(function () {
  "use strict";
  // Compatibility shim: canonical contract lives in packages/shared.
  if (typeof require === "function" && typeof module === "object" && module.exports) {
    module.exports = require("../../../packages/shared/service-contract.js");
    return;
  }
  // Browser: load packages/shared/service-contract.js before this file.
  if (!globalThis.LuminoServiceContract) {
    console.error("[Lumino] service-contract shim requires packages/shared/service-contract.js");
  }
})();
