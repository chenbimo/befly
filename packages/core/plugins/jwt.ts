/**
 * JWT 插件
 */

import { Jwt } from '../lib/jwt.js';

import type { Plugin } from '../types/plugin.js';

const jwtPlugin: Plugin = {
    handler: (context, config) => {
        return new Jwt(config?.auth);
    }
};

export default jwtPlugin;
