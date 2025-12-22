/**
 * Cipher 插件
 * 提供加密解密功能
 */

import type { Plugin } from "../types/plugin.js";

import { Cipher } from "../lib/cipher.js";

export default {
    handler: () => {
        return Cipher;
    }
} satisfies Plugin;
