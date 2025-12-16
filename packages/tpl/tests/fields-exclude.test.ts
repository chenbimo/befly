/**
 * 测试字段排除功能
 * 验证 fields 的3种写法：空数组、全部包含、全部排除
 */

import { Befly } from "befly";

async function testFieldsExclude() {
  // 强制启用数据库
  process.env.DATABASE_ENABLE = "1";

  // 创建 Befly 实例
  const befly = new Befly();

  // 启动服务器（这会初始化所有插件包括数据库）
  const server = await befly.start();

  // 获取 db 实例
  const db = befly.appContext.db;
  const redis = befly.appContext.redis;

  console.log("\n========== 测试开始 ==========\n");

  try {
    // 测试1：空数组（查询所有字段）
    console.log("【测试1】空数组 - 查询所有字段");
    const result1 = await db.getOne({
      table: "addon_admin_user",
      fields: [],
      where: { id: 1 },
    });
    console.log("结果字段数:", Object.keys(result1 || {}).length);
    console.log("字段列表:", Object.keys(result1 || {}).join(", "));

    // 测试2：指定包含字段
    console.log("\n【测试2】指定包含字段 - 只查询 id, name, email");
    const result2 = await db.getOne({
      table: "addon_admin_user",
      fields: ["id", "name", "email"],
      where: { id: 1 },
    });
    console.log("结果字段数:", Object.keys(result2 || {}).length);
    console.log("字段列表:", Object.keys(result2 || {}).join(", "));

    // 测试3：排除字段（排除敏感字段）
    console.log("\n【测试3】排除字段 - 排除 password, salt");
    const result3 = await db.getOne({
      table: "addon_admin_user",
      fields: ["!password", "!salt"],
      where: { id: 1 },
    });
    console.log("结果字段数:", Object.keys(result3 || {}).length);
    console.log("字段列表:", Object.keys(result3 || {}).join(", "));
    console.log("是否包含 password:", "password" in (result3 || {}));
    console.log("是否包含 salt:", "salt" in (result3 || {}));

    // 测试4：getList 支持排除字段
    console.log("\n【测试4】getList - 排除字段");
    const result4 = await db.getList({
      table: "addon_admin_user",
      fields: ["!password", "!salt"],
      page: 1,
      limit: 2,
    });
    console.log("查询到记录数:", result4.lists.length);
    if (result4.lists.length > 0) {
      console.log("第一条记录字段:", Object.keys(result4.lists[0]).join(", "));
      console.log("是否包含 password:", "password" in result4.lists[0]);
    }

    // 测试5：getAll 支持排除字段
    console.log("\n【测试5】getAll - 排除字段");
    const result5 = await db.getAll({
      table: "addon_admin_user",
      fields: ["!password", "!salt"],
    });
    console.log("查询到记录数:", result5.length);
    if (result5.length > 0) {
      console.log("第一条记录字段:", Object.keys(result5[0]).join(", "));
      console.log("是否包含 password:", "password" in result5[0]);
    }

    // 测试6：混用检测（应该报错）
    console.log("\n【测试6】混用检测 - 应该抛出错误");
    try {
      await db.getOne({
        table: "addon_admin_user",
        fields: ["id", "!password"],
        where: { id: 1 },
      });
      console.log("❌ 没有抛出错误（不符合预期）");
    } catch (error: any) {
      console.log("✅ 成功捕获错误:", error.message);
    }

    // 测试7：星号检测（应该报错）
    console.log("\n【测试7】星号检测 - 应该抛出错误");
    try {
      await db.getOne({
        table: "addon_admin_user",
        fields: ["*"],
        where: { id: 1 },
      });
      console.log("❌ 没有抛出错误（不符合预期）");
    } catch (error: any) {
      console.log("✅ 成功捕获错误:", error.message);
    }

    // 测试8：缓存性能测试
    console.log("\n【测试8】缓存性能测试 - 多次查询相同表");
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.getOne({
        table: "addon_admin_user",
        fields: ["!password", "!salt"],
        where: { id: 1 },
      });
    }
    const duration = Date.now() - start;
    console.log(`5次查询总耗时: ${duration}ms`);
    console.log(`平均耗时: ${(duration / 5).toFixed(2)}ms`);

    console.log("\n========== 测试完成 ==========\n");
  } catch (error: any) {
    console.error("\n❌ 测试失败:", error.message);
    console.error(error.stack);
  } finally {
    // 关闭服务器和连接
    server.stop(true);
    await db.close();
    await redis.close();
    process.exit(0);
  }
}

testFieldsExclude();
