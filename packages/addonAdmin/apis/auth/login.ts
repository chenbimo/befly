import { UAParser } from "ua-parser-js";

import adminTable from "../../tables/admin.json";

export default {
  name: "管理员登录",
  auth: false,
  fields: {
    account: {
      name: "账号",
      type: "string",
      min: 3,
      max: 100,
    },
    password: adminTable.password,
    loginType: {
      name: "登录类型",
      type: "string",
      regexp: "^(username|email|phone)$",
    },
  },
  required: ["account", "password", "loginType"],
  handler: async (befly, ctx) => {
    // 解析 User-Agent
    const userAgent = ctx.req.headers.get("user-agent") || "";
    const uaResult = UAParser(userAgent);

    // 日志数据（公共部分）
    const logData = {
      adminId: 0,
      username: ctx.body.account,
      nickname: "",
      ip: ctx.ip || "unknown",
      userAgent: userAgent.substring(0, 500),
      browserName: uaResult.browser.name || "",
      browserVersion: uaResult.browser.version || "",
      osName: uaResult.os.name || "",
      osVersion: uaResult.os.version || "",
      deviceType: uaResult.device.type || "desktop",
      deviceVendor: uaResult.device.vendor || "",
      deviceModel: uaResult.device.model || "",
      engineName: uaResult.engine.name || "",
      cpuArchitecture: uaResult.cpu.architecture || "",
      loginTime: Date.now(),
      loginResult: 0,
      failReason: "",
    };

    // 根据登录类型构建查询条件
    const whereCondition: Record<string, any> = {};
    if (ctx.body.loginType === "username") {
      whereCondition.username = ctx.body.account;
    } else if (ctx.body.loginType === "email") {
      whereCondition.email = ctx.body.account;
    } else if (ctx.body.loginType === "phone") {
      whereCondition.phone = ctx.body.account;
    }

    // 查询管理员
    const admin = await befly.db.getOne({
      table: "addon_admin_admin",
      where: whereCondition,
    });

    if (!admin?.id) {
      logData.failReason = "账号不存在";
      await befly.db.insData({ table: "addon_admin_login_log", data: logData });
      return befly.tool.No("账号或密码错误");
    }

    // 更新日志数据（已找到用户）
    logData.adminId = admin.id;
    logData.username = admin.username;
    logData.nickname = admin.nickname || "";

    // 验证密码
    try {
      const isValid = await befly.cipher.verifyPassword(ctx.body.password, admin.password);
      if (!isValid) {
        logData.failReason = "密码错误";
        await befly.db.insData({ table: "addon_admin_login_log", data: logData });
        return befly.tool.No("账号或密码错误");
      }
    } catch (error: any) {
      befly.logger.error({ err: error }, "密码验证失败");
      logData.failReason = "密码格式错误";
      await befly.db.insData({ table: "addon_admin_login_log", data: logData });
      return befly.tool.No("密码格式错误，请重新设置密码");
    }

    // 检查账号状态（state=1 表示正常，state=2 表示禁用）
    if (admin.state === 2) {
      logData.failReason = "账号已被禁用";
      await befly.db.insData({ table: "addon_admin_login_log", data: logData });
      return befly.tool.No("账号已被禁用");
    }

    // 登录成功，记录日志
    logData.loginResult = 1;
    await befly.db.insData({ table: "addon_admin_login_log", data: logData });

    // 生成 JWT Token（包含核心身份信息）
    const token = await befly.jwt.sign(
      {
        id: admin.id,
        nickname: admin.nickname,
        roleCode: admin.roleCode,
        roleType: admin.roleType,
      },
      {
        expiresIn: "30d",
      },
    );

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = admin;

    return befly.tool.Yes("登录成功", {
      token: token,
      userInfo: userWithoutPassword,
    });
  },
};
