/**
 * JWT 插件
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { Jwt } from "../lib/jwt.js";

export default {
    deps: [],
    handler: (context: BeflyContext) => {
        return new Jwt(context.config ? context.config.auth : undefined);
    }
} satisfies Plugin;
