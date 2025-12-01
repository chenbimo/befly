/**
 * JWT 插件
 */

import { Jwt } from '../lib/jwt.js';
import { beflyConfig } from '../befly.config.js';

import type { Plugin } from '../types/plugin.js';

const jwtPlugin: Plugin = {
    handler: () => {
        return new Jwt(beflyConfig.auth);
    }
};

export default jwtPlugin;
