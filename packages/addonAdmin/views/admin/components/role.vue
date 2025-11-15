<template>
    <t-dialog v-model:visible="$Data.visible" title="分配角色" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="20vh" @close="$Method.onClose">
        <div class="role-dialog">
            <div class="user-info">
                <t-tag type="info">{{ $Prop.rowData.username }}</t-tag>
                <span class="user-email">{{ $Prop.rowData.email }}</span>
            </div>
            <t-divider />
            <t-select v-model="$Data.checkedRoleCode" :options="$Data.roleOptions" placeholder="请选择角色" />
        </div>
        <template #footer>
            <t-button @click="$Method.onClose">取消</t-button>
            <t-button theme="primary" @click="$Method.onSubmit">确定</t-button>
        </template>
    </t-dialog>
</template>

<script setup>
import { $Http } from '@/plugins/http';

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    rowData: {
        type: Object,
        default: {}
    }
});

const $Emit = defineEmits(['update:modelValue', 'success']);

const $Data = $ref({
    visible: false,
    roleOptions: [],
    checkedRoleCode: ''
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await Promise.all([$Method.apiRoleList(), $Method.apiAdminRoleDetail()]);
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
    },

    // 加载角色列表
    async apiRoleList() {
        try {
            const res = await $Http('/addon/admin/role/list', {
                page: 1,
                limit: 1000
            });
            const roleList = res.data.lists || [];
            $Data.roleOptions = roleList
                .filter((role) => role.state === 1)
                .map((role) => ({
                    label: role.name,
                    value: role.code
                }));
        } catch (error) {
            console.error('加载角色列表失败:', error);
            MessagePlugin.info({ message: '加载角色列表失败', status: 'error' });
        }
    },

    // 加载管理员角色
    async apiAdminRoleDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/admin/roleDetail', {
                adminId: $Prop.rowData.id
            });
            $Data.checkedRoleCode = res.data.roleCode || '';
        } catch (error) {
            console.error('加载用户角色失败:', error);
        }
    },

    // 提交角色分配
    async onSubmit() {
        if (!$Data.checkedRoleCode) {
            MessagePlugin.info({ message: '请选择角色', status: 'warning' });
            return;
        }

        try {
            const res = await $Http('/addon/admin/admin/roleSave', {
                adminId: $Prop.rowData.id,
                roleCode: $Data.checkedRoleCode
            });

            if (res.code === 0) {
                MessagePlugin.info({ message: '角色分配成功', status: 'success' });
                $Method.onClose();
                $Emit('success');
            } else {
                MessagePlugin.info({ message: res.msg || '分配失败', status: 'error' });
            }
        } catch (error) {
            console.error('分配失败:', error);
            MessagePlugin.info({ message: '分配失败', status: 'error' });
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.role-dialog {
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .user-email {
            color: $text-secondary;
        }
    }
}
</style>
