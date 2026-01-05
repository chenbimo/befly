/**
 * Cipher 插件
 * 提供加密解密功能
 */

import type { Plugin } from "../types/plugin";

import { Cipher } from "../lib/cipher";

export default {
    deps: [],
    handler: () => {
        return Cipher;
    }
} satisfies Plugin;
