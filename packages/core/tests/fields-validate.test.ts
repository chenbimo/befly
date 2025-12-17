/**
 * 简单测试字段排除功能
 * 直接测试 validateAndClassifyFields 方法
 */

// 模拟测试函数（从 dbHelper 复制的逻辑）
function validateAndClassifyFields(fields?: string[]): {
    type: "all" | "include" | "exclude";
    fields: string[];
} {
    // 情况1：空数组或 undefined，表示查询所有
    if (!fields || fields.length === 0) {
        return { type: "all", fields: [] };
    }

    // 检测是否有星号（禁止）
    if (fields.some((f) => f === "*")) {
        throw new Error("fields 不支持 * 星号，请使用空数组 [] 或不传参数表示查询所有字段");
    }

    // 检测是否有空字符串或无效值
    if (fields.some((f) => !f || typeof f !== "string" || f.trim() === "")) {
        throw new Error("fields 不能包含空字符串或无效值");
    }

    // 统计包含字段和排除字段
    const includeFields = fields.filter((f) => !f.startsWith("!"));
    const excludeFields = fields.filter((f) => f.startsWith("!"));

    // 情况2：全部是包含字段
    if (includeFields.length > 0 && excludeFields.length === 0) {
        return { type: "include", fields: includeFields };
    }

    // 情况3：全部是排除字段
    if (excludeFields.length > 0 && includeFields.length === 0) {
        // 去掉感叹号前缀
        const cleanExcludeFields = excludeFields.map((f) => f.substring(1));
        return { type: "exclude", fields: cleanExcludeFields };
    }

    // 混用情况：报错
    throw new Error('fields 不能同时包含普通字段和排除字段（! 开头）。只能使用以下3种方式之一：\n1. 空数组 [] 或不传（查询所有）\n2. 全部指定字段 ["id", "name"]\n3. 全部排除字段 ["!password", "!token"]');
}

console.log("\n========== 测试 validateAndClassifyFields ==========\n");

// 测试1：空数组
console.log("【测试1】空数组");
const test1 = validateAndClassifyFields([]);
console.log("结果:", test1);
console.log("✅ 通过\n");

// 测试2：undefined
console.log("【测试2】undefined");
const test2 = validateAndClassifyFields(undefined);
console.log("结果:", test2);
console.log("✅ 通过\n");

// 测试3：包含字段
console.log("【测试3】包含字段");
const test3 = validateAndClassifyFields(["id", "name", "email"]);
console.log("结果:", test3);
console.log("✅ 通过\n");

// 测试4：排除字段
console.log("【测试4】排除字段");
const test4 = validateAndClassifyFields(["!password", "!salt"]);
console.log("结果:", test4);
console.log("✅ 通过\n");

// 测试5：混用（应该报错）
console.log("【测试5】混用（应该报错）");
try {
    validateAndClassifyFields(["id", "!password"]);
    console.log("❌ 没有抛出错误\n");
} catch (error: any) {
    console.log("✅ 成功捕获错误:", error.message, "\n");
}

// 测试6：星号（应该报错）
console.log("【测试6】星号（应该报错）");
try {
    validateAndClassifyFields(["*"]);
    console.log("❌ 没有抛出错误\n");
} catch (error: any) {
    console.log("✅ 成功捕获错误:", error.message, "\n");
}

// 测试7：空字符串（应该报错）
console.log("【测试7】空字符串（应该报错）");
try {
    validateAndClassifyFields(["id", "", "name"]);
    console.log("❌ 没有抛出错误\n");
} catch (error: any) {
    console.log("✅ 成功捕获错误:", error.message, "\n");
}

console.log("========== 所有测试完成 ==========\n");
