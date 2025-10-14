<template>
    <div class="user-manage">
        <t-card title="管理员管理" :bordered="false">
            <t-table
                :data="$Data.userList"
                :columns="$Data.columns"
                row-key="id"
                :loading="$Data.loading"
            >
                <template #status="{ row }">
                    <t-tag v-if="row.status === 1" theme="success">启用</t-tag>
                    <t-tag v-else theme="danger">禁用</t-tag>
                </template>

                <template #operation="{ row }">
                    <t-space>
                        <t-link theme="primary" @click="$Method.handleRole(row)">分配角色</t-link>
                    </t-space>
                </template>
            </t-table>
        </t-card>

        <!-- 角色分配对话框 -->
        <t-dialog
            v-model:visible="$Data.roleVisible"
            header="分配角色"
            width="600px"
            :on-confirm="$Method.handleRoleSubmit"
        >
            <div class="role-dialog">
                <div class="user-info">
                    <t-tag theme="primary">{{ $Data.currentUser.username }}</t-tag>
                    <span class="user-email">{{ $Data.currentUser.email }}</span>
                </div>
                <t-divider />
                <t-checkbox-group v-model="$Data.checkedRoleIds" :options="$Data.roleOptions" />
            </div>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';

// 响应式数据
const $Data = $ref({
    loading: false,
    userList: [] as any[],
    roleVisible: false,
    currentUser: {} as any,
    columns: [
        { colKey: 'username', title: '用户名', width: 150 },
        { colKey: 'email', title: '邮箱', width: 200 },
        { colKey: 'nickname', title: '昵称', width: 150 },
        { colKey: 'status', title: '状态', width: 80 },
        { colKey: 'operation', title: '操作', width: 150, fixed: 'right' }
    ],
    roleOptions: [] as any[],
    checkedRoleIds: [] as number[]
});

// 方法集合
const $Method = {
    // 加载用户列表
    async loadUserList() {
        $Data.loading = true;
        try {
            const res = await window.$api.post('/admin/list', {});
            if (res.code === 200 && res.data) {
                $Data.userList = res.data;
            }
        } catch (error) {
            MessagePlugin.error('加载用户列表失败');
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 加载角色列表
    async loadRoleList() {
        try {
            const res = await window.$api.post('/admin/roleList', {});
            if (res.code === 200 && res.data) {
                $Data.roleOptions = res.data
                    .filter((role: any) => role.status === 1)
                    .map((role: any) => ({
                        label: role.name,
                        value: role.id
                    }));
            }
        } catch (error) {
            MessagePlugin.error('加载角色列表失败');
            console.error(error);
        }
    },

    // 打开角色分配对话框
    async handleRole(row: any) {
        $Data.currentUser = row;
        $Data.roleVisible = true;
        
        // 加载角色列表
        await $Method.loadRoleList();
        
        // 加载该用户已有的角色
        try {
            const res = await window.$api.post('/admin/adminRoleGet', { adminId: row.id });
            if (res.code === 200 && res.data) {
                $Data.checkedRoleIds = res.data;
            }
        } catch (error) {
            MessagePlugin.error('加载用户角色失败');
            console.error(error);
        }
    },

    // 提交角色分配
    async handleRoleSubmit() {
        try {
            const res = await window.$api.post('/admin/adminRoleSave', {
                adminId: $Data.currentUser.id,
                roleIds: JSON.stringify($Data.checkedRoleIds)
            });
            
            if (res.code === 200) {
                MessagePlugin.success('角色分配成功');
                $Data.roleVisible = false;
                return true;
            } else {
                MessagePlugin.error(res.msg || '分配失败');
                return false;
            }
        } catch (error) {
            MessagePlugin.error('分配失败');
            console.error(error);
            return false;
        }
    }
};

// 初始化加载
$Method.loadUserList();
</script>

<style scoped lang="scss">
.user-manage {
    padding: 20px;
}

.role-dialog {
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .user-email {
            color: var(--td-text-color-secondary);
        }
    }
}
</style>
