/**
 * JWT 插件
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { Jwt } from "../lib/jwt";

export default {
    name: "jwt",
    deps: [],
    handler: (context: BeflyContext) => {
        return new Jwt(context.config ? context.config.auth : undefined);
    }
} satisfies Plugin;
