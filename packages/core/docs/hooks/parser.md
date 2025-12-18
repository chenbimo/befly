# parser Hook - 参数解析

> 解析请求体/查询参数，产出统一的 `ctx.body`。

## 作用

- GET：解析 URL 查询参数
- POST：解析 JSON（必要时也会支持 XML 等格式，取决于框架实现）
- 将解析结果写入 `ctx.body`

## 行为要点

- 解析失败（格式错误）时会提前中断请求，并返回安全的错误信息
- 该 hook 只负责“把数据变成 ctx.body”，字段校验由后续 `validator` 完成

## 常见问题

- Q: 为什么 `ctx.body` 里没有某些字段？
    - A: 可能被 fields/required 体系过滤/校验拦截了；请检查 `validator` 与 API 的 `fields/required` 配置。
