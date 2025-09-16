# auth 三形态详解

-   `true`：要求登录（`ctx.user.id` 存在）。未登录返回 `{ code:-1, msg:'未登录' }`。
-   `false`：公共接口。
-   `'role'`：要求 `ctx.user.role_type === 'role'`。
-   `['roleA','roleB']`：要求 `ctx.user.role` 在其一。

在 `core/main.js` 的 `/api/*` 路由中有相应判断逻辑，按需使用。
