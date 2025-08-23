// 兼容旧路径：从 syncDb.js 导入并再导出
import { SyncDb } from './syncDb.js';
export { SyncDb };
export const syncDatabase = SyncDb; // 兼容测试用命名导出
export default null;
