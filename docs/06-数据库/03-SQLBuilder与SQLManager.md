# SQLBuilder 与 SQLHelper

-   SQLHelper：高级 CRUD 封装（getDetail/getList/getAll/ins/upd/del/trans...），由 `plugins/db.js` 注入为 `befly.db`。
-   SQLBuilder：链式 SQL 构造器，来自 `utils/sqlBuilder.js`，可通过 `befly.db.query()` 获取。

## 示例：构造器

```js
const { sql, params } = befly.db.query().select(['u.id', 'u.name']).from('users u').leftJoin('profiles p', 'u.id = p.user_id').where({ 'u.status': 1, 'u.age$gte': 18 }).orderBy(['u.created_at#DESC']).limit(10).toSelectSql();

const rows = await befly.db.execute(sql, params);
```

更多完整能力见：`core/docs/curd.md`。
