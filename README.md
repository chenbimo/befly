# Befly - 蜜蜂飞舞

道生一，一生二，二生三，三生万物，v3 版本发布后可才是公测版本。

## 数据库配置（统一使用 MYSQL_URL）

使用 Bun SQL 的连接字符串进行配置：

-   MYSQL_URL：例如 `mysql://user:pass@127.0.0.1:3306/dbname`

说明：框架只读取 MYSQL_URL 作为最终连接串。
