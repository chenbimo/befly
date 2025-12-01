/**
 * Cipher 插件
 * 提供加密解密功能
 */

import { Cipher } from '../lib/cipher.js';

import type { Plugin } from '../types/plugin.js';

export default {
    name: 'cipher',
    handler: () => {
        return Cipher;
    }
} as Plugin;
