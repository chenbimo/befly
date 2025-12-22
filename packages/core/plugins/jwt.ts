/**
 * JWT 插件
 */

import type { Plugin } from "../types/plugin.js";

import { beflyConfig } from "../befly.config.js";
import { Jwt } from "../lib/jwt.js";

const jwtPlugin: Plugin = {
    name: "",
    deps: [],
    handler: () => {
        return new Jwt(beflyConfig.auth);
    }
};

export default jwtPlugin;
