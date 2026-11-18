import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../packages/platform");

export const platformDb = require(path.join(platformRoot, "db/index.js"));
