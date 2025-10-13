// 聚合运行 core 测试套件，便于在 tpl 目录执行 `bun test`
import '../../core/tests/db.test.js';
import '../../core/tests/field.test.js';
import '../../core/tests/jwt.test.js';
import '../../core/tests/redis.test.js';
import '../../core/tests/smoke-sql.test.js';
import '../../core/tests/sqlBuilder.test.js';
import '../../core/tests/sqlHelper.test.js';
import '../../core/tests/state.test.js';
import '../../core/tests/sync.test.js';
import '../../core/tests/table.test.js';
import '../../core/tests/util.test.js';
import '../../core/tests/xml.test.js';
