/**
 * JWT 插件
 * 提供 JSON Web Token 签名和验证功能
 */

import { Jwt } from '../lib/jwt.js';

import type { Plugin } from '../types/plugin.js';

export default {
    name: 'jwt',
    handler: (context, config) => {
        return Jwt;
    }
} as Plugin;
