<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <IconLucideActivity />
            <h2>性能指标</h2>
        </div>
        <div class="section-content">
            <div class="performance-grid">
                <div class="perf-metric">
                    <div class="perf-icon">
                        <IconLucideClock />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">平均响应</div>
                        <div class="perf-value">{{ performanceMetrics.avgResponseTime }}ms</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <IconLucideTrendingUp />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">QPS</div>
                        <div class="perf-value">{{ performanceMetrics.qps }}/s</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <IconLucideAlertCircle />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">错误率</div>
                        <div class="perf-value">{{ performanceMetrics.errorRate }}%</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <IconLucideActivity />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">活跃连接</div>
                        <div class="perf-value">{{ performanceMetrics.activeConnections }}</div>
                    </div>
                </div>
            </div>
            <!-- 最慢接口提示 -->
            <div v-if="performanceMetrics.slowestApi" class="perf-slowest">
                <IconLucideAlertTriangle />
                <span>最慢接口: {{ performanceMetrics.slowestApi.path }} ({{ performanceMetrics.slowestApi.time }}ms)</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import IconLucideActivity from '~icons/lucide/activity';
import IconLucideTrendingUp from '~icons/lucide/trending-up';
import IconLucideAlertCircle from '~icons/lucide/alert-circle';
import IconLucideClock from '~icons/lucide/clock';
import IconLucideAlertTriangle from '~icons/lucide/alert-triangle';
import { $Http } from '@/plugins/http';

// 组件内部数据
const performanceMetrics = $ref({
    avgResponseTime: 0,
    qps: 0,
    errorRate: 0,
    activeConnections: 0,
    slowestApi: null
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboard/performanceMetrics');
        Object.assign(performanceMetrics, data);
    } catch (error) {
        console.error('获取性能指标失败:', error);
    }
};

fetchData();
</script>

<style scoped lang="scss">
.performance-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-sm;
    margin-bottom: $spacing-sm;

    .perf-metric {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        padding: $spacing-sm $spacing-md;
        background: rgba($primary-color, 0.02);
        border-radius: $border-radius;
        border: 1px solid $border-color;
        transition: all 0.2s ease;

        &:hover {
            background: rgba($primary-color, 0.05);
            border-color: $primary-color;
        }

        .perf-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: $border-radius-small;
            background: linear-gradient(135deg, rgba($success-color, 0.1) 0%, rgba($success-color, 0.05) 100%);
            color: $success-color;
            flex-shrink: 0;
        }

        .perf-info {
            flex: 1;

            .perf-label {
                font-size: 14px;
                color: $text-secondary;
                margin-bottom: 2px;
            }

            .perf-value {
                font-size: 16px;
                font-weight: 700;
                color: $primary-color;
            }
        }
    }
}

.perf-slowest {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: $spacing-sm $spacing-md;
    background: rgba($warning-color, 0.05);
    border-radius: $border-radius-small;
    border: 1px solid rgba($warning-color, 0.2);
    font-size: 14px;
    color: $warning-color;

    span {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}
</style>
