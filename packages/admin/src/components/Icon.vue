<template>
    <component :is="iconComponent" :size="size" :color="color" :stroke-width="strokeWidth" style="margin-right: 8px; vertical-align: middle" v-bind="$attrs" />
</template>

<script setup>
import * as LucideIcons from 'lucide-vue-next';
import { computed, markRaw } from 'vue';

const props = defineProps({
    name: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        default: 16
    },
    color: {
        type: String,
        default: 'currentColor'
    },
    strokeWidth: {
        type: Number,
        default: 2
    }
});

// 动态获取图标组件
const iconComponent = computed(() => {
    const iconName = props.name;
    const icon = LucideIcons[iconName];

    if (!icon) {
        console.warn(`Icon "${props.name}" not found in lucide-vue-next`);
        return null;
    }

    // 使用 markRaw 避免响应式包装
    return markRaw(icon);
});
</script>
