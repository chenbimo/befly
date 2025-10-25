<template>
    <div class="section-block">
        <div class="section-header">
            <Icon name="Package" :size="20" />
            <h2>已安装插件</h2>
        </div>
        <div class="section-content">
            <div class="addon-list">
                <div v-for="addon in addonList" :key="addon.name" class="addon-item">
                    <div class="addon-icon">
                        <Icon name="Box" :size="24" />
                    </div>
                    <div class="addon-info">
                        <div class="addon-title">
                            <span class="addon-name">{{ addon.title }}</span>
                            <t-tag theme="success" variant="outline" size="small">{{ addon.version }}</t-tag>
                        </div>
                        <div class="addon-desc">{{ addon.description }}</div>
                    </div>
                    <div class="addon-status">
                        <t-tag v-if="addon.enabled" theme="success" size="small">已启用</t-tag>
                        <t-tag v-else theme="default" size="small">已禁用</t-tag>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
// 组件内部数据
const addonList = $ref([]);

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http('/addon/admin/dashboardAddonList');
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
    gap: 12px;

    .addon-item {
        background: $bg-color-container;
        border: 1px solid $border-color;
        border-left: 3px solid $primary-color;
        border-radius: $border-radius-small;
        padding: $spacing-md;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.3s;

        &:hover {
            border-left-color: $success-color;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
            transform: translateY(-2px);
        }

        .addon-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, $primary-color, #764ba2);
            border-radius: $border-radius-small;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
        }

        .addon-info {
            flex: 1;
            min-width: 0;

            .addon-title {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 4px;

                .addon-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: $text-primary;
                }
            }

            .addon-desc {
                font-size: 14px;
                color: $text-secondary;
                line-height: 1.4;
            }
        }

        .addon-status {
            flex-shrink: 0;
        }
    }
}
</style>
