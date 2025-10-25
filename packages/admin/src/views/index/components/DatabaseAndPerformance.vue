<template>
    <div class="dual-section-container">
        <!-- 数据库统计 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Database" :size="20" />
                <h2>数据库统计</h2>
            </div>
            <div class="section-content">
                <div class="database-grid-compact">
                    <div class="db-compact-item">
                        <div class="db-icon">
                            <Icon name="Table" :size="20" />
                        </div>
                        <div class="db-info">
                            <div class="db-label">数据表</div>
                            <div class="db-value">{{ databaseStats.tables }}<span>个</span></div>
                        </div>
                    </div>
                    <div class="db-compact-item">
                        <div class="db-icon">
                            <Icon name="Users" :size="20" />
                        </div>
                        <div class="db-info">
                            <div class="db-label">总用户</div>
                            <div class="db-value">{{ databaseStats.users }}<span>个</span></div>
                        </div>
                    </div>
                    <div class="db-compact-item">
                        <div class="db-icon">
                            <Icon name="FileText" :size="20" />
                        </div>
                        <div class="db-info">
                            <div class="db-label">总记录</div>
                            <div class="db-value">{{ databaseStats.records }}<span>条</span></div>
                        </div>
                    </div>
                    <div class="db-compact-item">
                        <div class="db-icon">
                            <Icon name="HardDrive" :size="20" />
                        </div>
                        <div class="db-info">
                            <div class="db-label">数据大小</div>
                            <div class="db-value">{{ databaseStats.size }}<span>MB</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 性能指标 -->
        <div class="section-block">
            <div class="section-header">
                <Icon name="Zap" :size="20" />
                <h2>性能指标</h2>
            </div>
            <div class="section-content">
                <div class="performance-grid">
                    <div class="perf-metric">
                        <div class="perf-icon">
                            <Icon name="Clock" :size="18" />
                        </div>
                        <div class="perf-info">
                            <div class="perf-label">平均响应</div>
                            <div class="perf-value">{{ performanceMetrics.avgResponseTime }}ms</div>
                        </div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-icon">
                            <Icon name="TrendingUp" :size="18" />
                        </div>
                        <div class="perf-info">
                            <div class="perf-label">QPS</div>
                            <div class="perf-value">{{ performanceMetrics.qps }}/s</div>
                        </div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-icon">
                            <Icon name="AlertCircle" :size="18" />
                        </div>
                        <div class="perf-info">
                            <div class="perf-label">错误率</div>
                            <div class="perf-value">{{ performanceMetrics.errorRate }}%</div>
                        </div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-icon">
                            <Icon name="Activity" :size="18" />
                        </div>
                        <div class="perf-info">
                            <div class="perf-label">活跃连接</div>
                            <div class="perf-value">{{ performanceMetrics.activeConnections }}</div>
                        </div>
                    </div>
                </div>
                <!-- 最慢接口提示 -->
                <div v-if="performanceMetrics.slowestApi" class="perf-slowest">
                    <Icon name="AlertTriangle" :size="14" />
                    <span>最慢接口: {{ performanceMetrics.slowestApi.path }} ({{ performanceMetrics.slowestApi.time }}ms)</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const databaseStats = $ref({
    tables: 28,
    users: 1256,
    records: 15678,
    size: 128
});

const performanceMetrics = $ref({
    avgResponseTime: 125,
    qps: 856,
    errorRate: 0.8,
    activeConnections: 45,
    slowestApi: {
        path: '/addon/admin/menuList',
        time: 450
    }
});
</script>

<style scoped lang="scss">
.dual-section-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.database-grid-compact {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    .db-compact-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        background: linear-gradient(135deg, rgba($primary-color, 0.03) 0%, rgba($primary-color, 0.01) 100%);
        border-radius: 8px;
        border: 1px solid rgba($primary-color, 0.1);
        transition: all 0.3s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba($primary-color, 0.1);
        }

        .db-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: linear-gradient(135deg, $primary-color 0%, lighten($primary-color, 10%) 100%);
            color: white;
            flex-shrink: 0;
        }

        .db-info {
            flex: 1;
            min-width: 0;

            .db-label {
                font-size: 12px;
                color: $text-secondary;
                margin-bottom: 2px;
            }

            .db-value {
                font-size: 18px;
                font-weight: 700;
                color: $text-primary;

                span {
                    font-size: 12px;
                    font-weight: 400;
                    color: $text-placeholder;
                    margin-left: 2px;
                }
            }
        }
    }
}

.performance-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 10px;

    .perf-metric {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: $bg-color-container;
        border-radius: 8px;
        border: 1px solid $border-color;

        .perf-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: linear-gradient(135deg, rgba($success-color, 0.1) 0%, rgba($success-color, 0.05) 100%);
            color: $success-color;
            flex-shrink: 0;
        }

        .perf-info {
            flex: 1;

            .perf-label {
                font-size: 12px;
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
    padding: 8px 12px;
    background: rgba($warning-color, 0.05);
    border-radius: 6px;
    border: 1px solid rgba($warning-color, 0.2);
    font-size: 12px;
    color: $warning-color;

    span {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}
</style>
