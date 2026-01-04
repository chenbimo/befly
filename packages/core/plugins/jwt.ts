/**
 * JWT 插件
 */

import type { BeflyContext } from "../types/befly.ts";
import type { Plugin } from "../types/plugin.ts";

import { Jwt } from "../lib/jwt.ts";

export default {
    deps: [],
    handler: (context: BeflyContext) => {
        return new Jwt(context.config ? context.config.auth : undefined);
    }
} satisfies Plugin;
