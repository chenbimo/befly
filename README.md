# Befly - 蜜蜂飞舞

道生一，一生二，二生三，三生万物，v3 版本发布后可才是公测版本。

## 数据库配置（DB\_\* 通用参数）

统一使用以下环境变量配置数据库，支持 sqlite/mysql/postgresql：

-   DB_TYPE：数据库类型（sqlite | mysql | postgresql）
-   DB_HOST：主机（sqlite 可忽略）
-   DB_PORT：端口（sqlite 可忽略）
-   DB_USER：用户名（sqlite 可忽略）
-   DB_PASS：密码（sqlite 可忽略）
-   DB_NAME：数据库名称（sqlite 为文件路径或 :memory:）

示例：

-   MySQL: DB_TYPE=mysql, DB_HOST=127.0.0.1, DB_PORT=3306, DB_USER=user, DB_PASS=pass, DB_NAME=demo
-   PostgreSQL: DB_TYPE=postgresql, DB_HOST=127.0.0.1, DB_PORT=5432, DB_USER=user, DB_PASS=pass, DB_NAME=demo
-   SQLite: DB_TYPE=sqlite, DB_NAME=/path/to/demo.sqlite 或 :memory:
