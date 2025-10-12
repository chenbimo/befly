/**
 * syncDb 状态管理模块
 *
 * 包含：
 * - 性能统计（阶段耗时、总体计时）
 * - 进度信息记录
 */

/**
 * 阶段统计信息
 */
export interface PhaseStats {
    startTime: number;
    endTime?: number;
    duration?: number;
}

/**
 * 性能统计器
 */
export class PerformanceTracker {
    private phases = new Map<string, PhaseStats>();
    private globalStart: number;

    constructor() {
        this.globalStart = Date.now();
    }

    /**
     * 标记阶段开始
     */
    markPhase(phase: string): void {
        this.phases.set(phase, { startTime: Date.now() });
    }

    /**
     * 获取阶段耗时
     */
    getPhaseTime(phase: string): string {
        const stats = this.phases.get(phase);
        if (!stats) return '0ms';

        const duration = stats.duration || Date.now() - stats.startTime;
        return duration > 1000 ? `${(duration / 1000).toFixed(2)}s` : `${duration}ms`;
    }

    /**
     * 完成阶段并记录耗时
     */
    finishPhase(phase: string): void {
        const stats = this.phases.get(phase);
        if (stats && !stats.endTime) {
            stats.endTime = Date.now();
            stats.duration = stats.endTime - stats.startTime;
        }
    }

    /**
     * 获取总耗时
     */
    getTotalTime(): string {
        const duration = Date.now() - this.globalStart;
        return duration > 1000 ? `${(duration / 1000).toFixed(2)}s` : `${duration}ms`;
    }

    /**
     * 输出所有阶段统计
     */
    logStats(): void {
        console.log('\n⏱️  性能统计:');
        for (const [phase, stats] of this.phases) {
            const duration = stats.duration || Date.now() - stats.startTime;
            const timeStr = duration > 1000 ? `${(duration / 1000).toFixed(2)}s` : `${duration}ms`;
            console.log(`   ${phase}: ${timeStr}`);
        }
        console.log(`   总耗时: ${this.getTotalTime()}`);
    }
}

/**
 * 进度记录器
 */
export class ProgressLogger {
    /**
     * 记录表处理进度
     */
    logTableProgress(current: number, total: number, tableName: string): void {
        console.log(`\n[${current}/${total}] 处理表: ${tableName}`);
    }

    /**
     * 记录字段变更进度
     */
    logFieldChangeProgress(current: number, total: number, fieldName: string, changeType: string): void {
        console.log(`   [${current}/${total}] 修改字段 ${fieldName} (${changeType})`);
    }

    /**
     * 记录索引创建进度
     */
    logIndexProgress(current: number, total: number, indexName: string): void {
        console.log(`   [${current}/${total}] 创建索引: ${indexName}`);
    }
}
