<template>
    <div class="user-manage">
        <t-card title="管理员管理" :bordered="false">
            <t-table :data="$Data.userList" :columns="$Data.columns" row-key="id" :loading="$Data.loading" :pagination="$Data.pagination" @page-change="$Method.onPageChange">
                <template #state="{ row }">
                    <t-tag v-if="row.state === 1" theme="success">正常</t-tag>
                    <t-tag v-else-if="row.state === 2" theme="warning">禁用</t-tag>
                    <t-tag v-else theme="danger">已删除</t-tag>
                </template>

                <template #lastLoginTime="{ row }">
                    <span v-if="row.lastLoginTime">{{ new Date(Number(row.lastLoginTime)).toLocaleString() }}</span>
                    <span v-else>-</span>
                </template>

                <template #operation="{ row }">
                    <t-space>
                        <t-link theme="primary" @click="$Method.handleRole(row)">分配角色</t-link>
                    </t-space>
                </template>
            </t-table>
        </t-card>

        <!-- 角色分配对话框 -->
        <t-dialog v-model:visible="$Data.roleVisible" header="分配角色" width="600px" :on-confirm="$Method.handleRoleSubmit">
            <div class="role-dialog">
                <div class="user-info">
                    <t-tag theme="primary">{{ $Data.currentUser.username }}</t-tag>
                    <span class="user-email">{{ $Data.currentUser.email }}</span>
                </div>
                <t-divider />
                <t-select v-model="$Data.checkedRoleCode" :options="$Data.roleOptions" placeholder="请选择角色" />
            </div>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
// 响应式数据
const $Data = $ref({
    loading: false,
    userList: [] as any[],
    pagination: {
        current: 1,
        pageSize: 10,
        total: 0
    },
    roleVisible: false,
    currentUser: {} as any,
    columns: [
        { colKey: 'username', title: '用户名', width: 150 },
        { colKey: 'email', title: '邮箱', width: 200 },
        { colKey: 'nickname', title: '昵称', width: 150 },
        { colKey: 'state', title: '状态', width: 100 },
        { colKey: 'roleCode', title: '角色', width: 120 },
        { colKey: 'lastLoginTime', title: '最后登录', width: 180 },
        { colKey: 'operation', title: '操作', width: 150, fixed: 'right' }
    ],
    roleOptions: [] as any[],
    checkedRoleCode: '' as string
});

// 方法集合
const $Method = {
    // 加载用户列表
    async loadUserList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/adminList', {
                page: $Data.pagination.current,
                limit: $Data.pagination.pageSize
            });
            if (res.code === 0 && res.data) {
                // getList 返回分页对象 { list, total, page, limit, pages }
                $Data.userList = res.data.list || [];
                $Data.pagination.total = res.data.total || 0;
            }
        } catch (error) {
            MessagePlugin.error('加载用户列表失败');
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 分页变化
    onPageChange(pageInfo: any) {
        $Data.pagination.current = pageInfo.current;
        $Data.pagination.pageSize = pageInfo.pageSize;
        $Method.loadUserList();
    },

    // 加载角色列表
    async loadRoleList() {
        try {
            const res = await $Http('/addon/admin/roleList', {});
            if (res.code === 0 && res.data) {
                // getList 返回分页对象
                const roleList = res.data.list || res.data || [];
                $Data.roleOptions = roleList
                    .filter((role: any) => role.state === 1)
                    .map((role: any) => ({
                        label: role.name,
                        value: role.code
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
            const res = await $Http('/addon/admin/adminRoleGet', { adminId: row.id });
            if (res.code === 0 && res.data) {
                $Data.checkedRoleCode = res.data.roleCode || '';
            }
        } catch (error) {
            MessagePlugin.error('加载用户角色失败');
            console.error(error);
        }
    },

    // 提交角色分配
    async handleRoleSubmit() {
        if (!$Data.checkedRoleCode) {
            MessagePlugin.warning('请选择角色');
            return false;
        }

        try {
            const res = await $Http('/addon/admin/adminRoleSave', {
                adminId: $Data.currentUser.id,
                roleCode: $Data.checkedRoleCode
            });

            if (res.code === 0) {
                MessagePlugin.success('角色分配成功');
                $Data.roleVisible = false;
                await $Method.loadUserList();
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
