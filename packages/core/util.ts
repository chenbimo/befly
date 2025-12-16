/**
 * 核心工具函数
 */

export { setCorsOptions } from "./utils/cors.js";
export { ErrorResponse, FinalResponse } from "./utils/response.js";
export { normalizeApiPath, makeRouteKey } from "./utils/route.js";
export { getProcessRole, isPrimaryProcess } from "./utils/process.js";
export { scanModules, sortModules } from "./utils/modules.js";

export type { ProcessRole } from "./utils/process.js";
