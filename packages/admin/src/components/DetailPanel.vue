<template>
    <div class="detail-panel">
        <div class="detail-content">
            <div v-if="data">
                <div v-for="field in normalizedFields" :key="field.key" class="detail-item">
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

<script setup lang="ts">
import { computed } from "vue";
import { Tag as TTag } from "tdesign-vue-next";

const props = defineProps({
    /**
     * 当前行数据
     */
    data: {
        type: Object,
        default: null
    },
    /**
     * 字段配置，支持两种格式：
     * 1. fields 格式: [{ key: 'id', label: 'ID' }]
     * 2. columns 格式: [{ colKey: 'id', title: 'ID' }]
     * 自动过滤 row-select、operation 等非数据列
     */
    fields: {
        type: Array,
        required: true
    },
    /**
     * 需要过滤的列 key
     */
    excludeKeys: {
        type: Array,
        default: () => ["row-select", "operation", "index"]
    },
    /**
     * 空数据时的提示文字
     */
    emptyText: {
        type: String,
        default: "暂无数据"
    }
});

/**
 * 标准化字段配置，支持 columns 和 fields 两种格式
 */
const normalizedFields = computed(() => {
    const dataId = props.data && typeof props.data.id !== "undefined" ? props.data.id : undefined;

    const fields = props.fields
        .filter((item) => {
            const key = item.colKey || item.key;
            return key && !props.excludeKeys.includes(key);
        })
        .map((item) => ({
            key: item.colKey || item.key,
            label: item.title || item.label,
            default: item.default,
            formatter: item.formatter
        }));

    // 约定：页面表格不展示 id，但右侧详情始终展示 id（如果 data.id 存在）
    if (typeof dataId !== "undefined" && !fields.some((f) => f.key === "id")) {
        fields.unshift({
            key: "id",
            label: "ID",
            default: "-",
            formatter: undefined
        });
    }

    return fields;
});

/**
 * 格式化字段值
 * @param {any} value - 字段值
 * @param {Object} field - 字段配置
 * @returns {string} 格式化后的值
 */
function formatValue(value, field) {
    if (value === null || value === undefined || value === "") {
        return field.default || "-";
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
    background: var(--bg-color-container);
}

.detail-content {
    padding: var(--spacing-md);
}

.detail-item {
    margin-bottom: var(--spacing-sm);
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color-light);

    &:first-child {
        padding-top: 0;
    }

    &:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }
}

.detail-label {
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
}

.detail-value {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    word-break: break-all;
    line-height: 1.5;
}

.detail-empty {
    text-align: center;
    padding: var(--spacing-xl) 0;
    color: var(--text-placeholder);
}

.empty-icon {
    font-size: 40px;
    margin-bottom: var(--spacing-sm);
    opacity: 0.5;
}

.empty-text {
    font-size: var(--font-size-sm);
}
</style>
