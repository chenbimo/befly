# auth 三形态详解

-   `true`：要求登录（`ctx.user.id` 存在）。未登录返回 `{ code:-1, msg:'未登录' }`。
-   `false`：公共接口。
-   `'role'`：要求 `ctx.user.role_type === 'role'`。
-   `['roleA','roleB']`：要求 `ctx.user.role` 在其一。

在 `core/main.js` 的 `/api/*` 路由中有相应判断逻辑，按需使用。

## 示例

```js
// 1) 需要登录
export default Api.GET('用户信息', true, {}, [], async (befly, ctx)=> Yes('ok', { user: ctx.user }));

// 2) 公共接口
export default Api.GET('公告', false, {}, [], async ()=> Yes('ok', { list: [] }));

// 3) 单角色
export default Api.POST('管理员操作', 'admin', {}, [], async ()=> Yes('ok'));

// 4) 多角色
export default Api.POST('运营与财务', ['op','fin'], {}, [], async ()=> Yes('ok'));
```
