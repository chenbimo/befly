/**
 * 示例 / 测试接口
 *
 * 注意：本文件仅用于模板演示与本地测试，不建议在生产环境启用或依赖其行为。
 */

import type { BeflyContext } from "befly/types/befly";

export default {
    name: "测试接口",
    handler: async (befly: BeflyContext) => {
        // 返回成功信息
        return befly.tool.Yes("测试成功");
    }
};
