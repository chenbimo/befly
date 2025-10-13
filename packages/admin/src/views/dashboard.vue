<template>
    <div class="dashboard">
        <t-row :gutter="16">
            <t-col :span="6">
                <t-card title="总用户数" hover-shadow>
                    <template #actions>
                        <user-icon size="24px" />
                    </template>
                    <div class="stat-value">1,234</div>
                    <div class="stat-desc">较昨日 +12%</div>
                </t-card>
            </t-col>

            <t-col :span="6">
                <t-card title="今日访问" hover-shadow>
                    <template #actions>
                        <chart-line-icon size="24px" />
                    </template>
                    <div class="stat-value">567</div>
                    <div class="stat-desc">较昨日 +8%</div>
                </t-card>
            </t-col>

            <t-col :span="6">
                <t-card title="订单数量" hover-shadow>
                    <template #actions>
                        <shop-icon size="24px" />
                    </template>
                    <div class="stat-value">89</div>
                    <div class="stat-desc">较昨日 -3%</div>
                </t-card>
            </t-col>

            <t-col :span="6">
                <t-card title="收入金额" hover-shadow>
                    <template #actions>
                        <money-icon size="24px" />
                    </template>
                    <div class="stat-value">¥12,345</div>
                    <div class="stat-desc">较昨日 +15%</div>
                </t-card>
            </t-col>
        </t-row>

        <t-card title="欢迎使用" class="welcome-card">
            <p>Befly Admin 后台管理系统</p>
            <t-space>
                <t-tag theme="primary">Vue 3</t-tag>
                <t-tag theme="success">TDesign</t-tag>
                <t-tag theme="warning">TypeScript</t-tag>
                <t-tag theme="danger">Vite</t-tag>
            </t-space>
        </t-card>
    </div>
</template>

<script setup lang="ts">
import { UserIcon, ChartLineIcon, ShopIcon, MoneyIcon } from 'tdesign-icons-vue-next';
</script>

<style scoped lang="scss">
.dashboard {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.stat-value {
    font-size: 32px;
    font-weight: 600;
    margin: 16px 0 8px;
}

.stat-desc {
    color: var(--td-text-color-secondary);
    font-size: 14px;
}

.welcome-card {
    margin-top: 16px;
}

.welcome-card p {
    margin-bottom: 16px;
    font-size: 16px;
}
</style>
