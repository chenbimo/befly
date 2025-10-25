<template>
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
                        <div class="db-value">{{ databaseStats.tableCount }}<span>个</span></div>
                    </div>
                </div>
                <div class="db-compact-item">
                    <div class="db-icon">
                        <Icon name="FileText" :size="20" />
                    </div>
                    <div class="db-info">
                        <div class="db-label">总记录</div>
                        <div class="db-value">{{ databaseStats.recordCount }}<span>条</span></div>
                    </div>
                </div>
                <div class="db-compact-item">
                    <div class="db-icon">
                        <Icon name="HardDrive" :size="20" />
                    </div>
                    <div class="db-info">
                        <div class="db-label">数据大小</div>
                        <div class="db-value">{{ databaseStats.dbSize }}<span>MB</span></div>
                    </div>
                </div>
                <div class="db-compact-item">
                    <div class="db-icon">
                        <Icon name="Activity" :size="20" />
                    </div>
                    <div class="db-info">
                        <div class="db-label">活跃连接</div>
                        <div class="db-value">{{ databaseStats.connections }}<span>个</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const databaseStats = $ref({
    dbSize: 0,
    tableCount: 0,
    recordCount: 0,
    connections: 0
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboardDatabaseStats');
        Object.assign(databaseStats, data);
    } catch (error) {
        console.error('获取数据库统计失败:', error);
    }
};

fetchData();
</script>

<style scoped lang="scss">
.database-grid-compact {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-md;

    .db-compact-item {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        padding: $spacing-md;
        background: linear-gradient(135deg, rgba($primary-color, 0.03) 0%, rgba($primary-color, 0.01) 100%);
        border-radius: $border-radius;
        border: 1px solid rgba($primary-color, 0.1);
        transition: all 0.3s ease;

        &:hover {
            background: linear-gradient(135deg, rgba($primary-color, 0.05) 0%, rgba($primary-color, 0.02) 100%);
            border-color: $primary-color;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba($primary-color, 0.1);
        }

        .db-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: $border-radius;
            background: linear-gradient(135deg, $primary-color 0%, #1a6eeb 100%);
            color: white;
            flex-shrink: 0;
        }

        .db-info {
            flex: 1;
            min-width: 0;

            .db-label {
                font-size: 14px;
                color: $text-secondary;
                margin-bottom: 4px;
            }

            .db-value {
                font-size: 18px;
                font-weight: 700;
                color: $text-primary;

                span {
                    font-size: 14px;
                    font-weight: 400;
                    color: $text-placeholder;
                    margin-left: 2px;
                }
            }
        }
    }
}
</style>
