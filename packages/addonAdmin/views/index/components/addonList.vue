<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <i-lucide:package />
            <h2>已安装插件</h2>
        </div>
        <div class="section-content">
            <div class="addon-list">
                <div v-for="addon in addonList" :key="addon.name" class="addon-item">
                    <div class="addon-icon">
                        <i-lucide:box />
                    </div>
                    <div class="addon-info">
                        <div class="addon-title">
                            <span class="addon-name">{{ addon.title }}</span>
                            <t-tag type="success" size="small">{{ addon.version }}</t-tag>
                        </div>
                        <div class="addon-desc">{{ addon.description }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { $Http } from '@/plugins/http';

// 组件内部数据
const addonList = $ref([]);

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboard/addonList');
        addonList.splice(0, addonList.length, ...data);
    } catch (error) {
        console.error('获取插件列表失败:', error);
    }
};

fetchData();
</script>

<style scoped lang="scss">
.addon-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .addon-item {
        position: relative;
        background: var(--bg-color-container);
        border: 1px solid var(--border-color);
        border-left: 3px solid var(--primary-color);
        border-radius: var(--border-radius-small);
        padding: 10px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;

        &:hover {
            border-left-color: var(--success-color);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
            transform: translateY(-2px);
        }

        .addon-status-badge {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--text-disabled);
            transition: all 0.3s;

            &::after {
                content: '';
                position: absolute;
                top: -2px;
                right: -2px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--success-color);
                box-shadow: 0 0 0 2px rgba(var(--success-color-rgb), 0.2);
        }

        .addon-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--primary-color), #764ba2);
            border-radius: var(--border-radius-small);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
        }

        .addon-info {
            flex: 1;
            min-width: 0;
            padding-right: 16px;

            .addon-title {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 2px;

                .addon-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
            }

            .addon-desc {
                font-size: 14px;
                color: var(--text-secondary);
                line-height: 1.3;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }
    }
}
</style>
