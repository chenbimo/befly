/**
 * Cipher 插件
 * 提供加密解密功能
 */

import type { Plugin } from "../types/plugin";

import { Cipher } from "../lib/cipher";

const cipherPlugin: Plugin = {
    name: "cipher",
    enable: true,
    deps: [],
    handler: () => {
        return Cipher;
    }
};

export default cipherPlugin;
