/**
 * JWT 插件
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { Jwt } from "../lib/jwt";

const jwtPlugin: Plugin = {
    name: "jwt",
    enable: true,
    deps: [],
    handler: (context: BeflyContext) => {
        return new Jwt(context.config ? context.config.auth : undefined);
    }
};

export default jwtPlugin;
