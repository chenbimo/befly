<template>
    <div class="detail-panel">
        <div class="detail-content">
            <div v-if="data">
                <div v-for="field in fields" :key="field.key" class="detail-item">
                    <div class="detail-label">{{ field.label }}</div>
                    <div class="detail-value">
                        <!-- 状态字段特殊处理 -->
                        <template v-if="field.key === 'state'">
                            <TTag v-if="data.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                            <TTag v-else-if="data.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                            <TTag v-else-if="data.state === 0" shape="round" theme="danger" variant="light-outline">已删除</TTag>
                        </template>
                        <!-- 自定义插槽 -->
                        <template v-else-if="$slots[field.key]">
                            <slot :name="field.key" :value="data[field.key]" :row="data"></slot>
                        </template>
                        <!-- 默认显示 -->
                        <template v-else>
                            {{ formatValue(data[field.key], field) }}
                        </template>
                    </div>
                </div>
            </div>
            <div v-else class="detail-empty">
                <div class="empty-icon">📋</div>
                <div class="empty-text">{{ emptyText }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Tag as TTag } from 'tdesign-vue-next';

defineProps({
    /**
     * 当前行数据
     */
    data: {
        type: Object,
        default: null
    },
    /**
     * 字段配置
     * @example [{ key: 'id', label: 'ID' }, { key: 'name', label: '名称', default: '-' }]
     */
    fields: {
        type: Array,
        required: true
    },
    /**
     * 空数据时的提示文字
     */
    emptyText: {
        type: String,
        default: '暂无数据'
    }
});

/**
 * 格式化字段值
 * @param {any} value - 字段值
 * @param {Object} field - 字段配置
 * @returns {string} 格式化后的值
 */
function formatValue(value, field) {
    if (value === null || value === undefined || value === '') {
        return field.default || '-';
    }
    if (field.formatter) {
        return field.formatter(value);
    }
    return value;
}
</script>

<style scoped lang="scss">
.detail-panel {
    height: 100%;
    overflow: auto;
}

.detail-content {
    padding: 16px;
}

.detail-item {
    margin-bottom: 16px;

    &:last-child {
        margin-bottom: 0;
    }
}

.detail-label {
    color: var(--text-secondary);
    margin-bottom: 4px;
    font-size: 12px;
}

.detail-value {
    color: var(--text-primary);
    font-size: 14px;
    word-break: break-all;
}

.detail-empty {
    text-align: center;
    padding: 48px 0;
    color: var(--text-placeholder);
}

.empty-icon {
    font-size: 48px;
    margin-bottom: 8px;
}

.empty-text {
    font-size: 14px;
}
</style>
