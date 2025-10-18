# JWT 签发与校验

- 工具：`core/utils/jwt.js` 暴露 `Jwt.sign(payload)`、`Jwt.verify(token)`。
- 框架在 `/api/*` 中自动解析 `Authorization: Bearer <token>` 并注入 `ctx.user`。

## 签发

```js
import { Jwt, Yes } from 'befly';

export default Api.POST('登录', false, { username: '', password: '' }, ['username', 'password'], async (befly, ctx) => {
    // 1. 校验账号密码...
    const payload = { id: 123, role: 'admin', roleType: 'admin', roleCode: 'admin' };
    const token = await Jwt.sign(payload);
    return Yes('登录成功', { token });
});
```

## 校验

- 由框架在请求入口处理，失败时 `ctx.user = {}`；你也可以在自定义中间层再次校验或提取更多上下文。

## 示例

- 获取 token：

```
curl -X POST http://127.0.0.1:3000/api/app/auth/login -H "Content-Type: application/json" -d "{\"username\":\"u\",\"password\":\"p\"}"
```

- 携带 token 访问：

```
curl -X POST http://127.0.0.1:3000/api/app/test/hi -H "Authorization: Bearer <token>"
```
