<template>
    <div class="system-page">
        <t-row :gutter="16">
            <t-col :span="6">
                <t-card title="菜单管理" :bordered="true" hover class="system-card" @click="$Method.goTo('/system/menu')">
                    <template #avatar>
                        <view-list-icon size="32px" />
                    </template>
                    <div class="card-content">
                        <p>管理系统菜单结构和权限</p>
                        <t-tag theme="primary">增删改查</t-tag>
                    </div>
                </t-card>
            </t-col>
            <t-col :span="6">
                <t-card title="角色管理" :bordered="true" hover class="system-card" @click="$Method.goTo('/system/role')">
                    <template #avatar>
                        <user-icon size="32px" />
                    </template>
                    <div class="card-content">
                        <p>管理系统角色和权限分配</p>
                        <t-tag theme="success">权限配置</t-tag>
                    </div>
                </t-card>
            </t-col>
        </t-row>
    </div>
</template>

<script setup lang="ts">
const router = useRouter();

const $Method = {
    goTo(path: string) {
        router.push(path);
    }
};
</script>

<style scoped lang="scss">
.system-page {
    padding: 20px;
}

.system-card {
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
}

.card-content {
    p {
        color: var(--td-text-color-secondary);
        margin: 12px 0;
    }
}
</style>
