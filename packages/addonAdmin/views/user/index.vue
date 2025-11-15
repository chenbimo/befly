<template>
    <div class="user-manage">
        <!-- 上：过滤和操作栏 -->
        <div class="toolbar">
            <div class="toolbar-left">
                <t-button theme="primary" @click="$Method.handleAdd">
                    <template #icon>
                        <i-lucide:plus />
                    </template>
                    添加管理员
                </t-button>
            </div>
            <div class="toolbar-right">
                <t-space>
                    <t-input v-model="$Data.searchKeyword" placeholder="搜索用户名/邮箱" clearable style="width: 200px" @enter="$Method.handleSearch" />
                    <t-select v-model="$Data.searchState" placeholder="状态" clearable style="width: 120px" :options="$Data.stateOptions" @change="$Method.handleSearch" />
                    <t-button theme="default" @click="$Method.handleSearch">
                        <template #icon>
                            <i-lucide:search />
                        </template>
                        搜索
                    </t-button>
                    <t-button theme="default" @click="$Method.handleReset">
                        <template #icon>
                            <i-lucide:rotate-cw />
                        </template>
                        重置
                    </t-button>
                </t-space>
            </div>
        </div>

        <!-- 中：数据表格 -->
        <div class="table-wrapper">
            <t-table :data="$Data.userList" :columns="$Data.columns" row-key="id" :loading="$Data.loading" bordered stripe hover max-height="100%">
                <template #state="{ row }">
                    <t-tag v-if="row.state === 1" type="success">正常</t-tag>
                    <t-tag v-else-if="row.state === 2" type="warning">禁用</t-tag>
                    <t-tag v-else type="danger">已删除</t-tag>
                </template>

                <template #lastLoginTime="{ row }">
                    <span v-if="row.lastLoginTime">{{ new Date(Number(row.lastLoginTime)).toLocaleString() }}</span>
                    <span v-else>-</span>
                </template>

                <template #operation="{ row }">
                    <t-space>
                        <t-link theme="primary" @click="$Method.handleRole(row)">分配角色</t-link>
                        <t-link theme="warning" @click="$Method.handleEdit(row)">编辑</t-link>
                        <t-link theme="danger" @click="$Method.handleDelete(row)">删除</t-link>
                    </t-space>
                </template>
            </t-table>
        </div>

        <!-- 下：分页栏 -->
        <div class="pagination-wrapper">
            <t-pagination v-model="$Data.pagination.current" v-model:page-size="$Data.pagination.pageSize" :total="$Data.pagination.total" :page-size-options="[10, 20, 50, 100]" show-jumper show-page-size @change="$Method.onPageChange" />
        </div>

        <!-- 角色分配对话框 -->
        <t-dialog v-model:visible="$Data.roleVisible" header="分配角色" width="600px" :on-confirm="$Method.handleRoleSubmit">
            <div class="role-dialog">
                <div class="user-info">
                    <t-tag type="primary">{{ $Data.currentUser.username }}</t-tag>
                    <span class="user-email">{{ $Data.currentUser.email }}</span>
                </div>
                <t-divider />
                <t-select v-model="$Data.checkedRoleCode" :options="$Data.roleOptions" placeholder="请选择角色" />
            </div>
        </t-dialog>
    </div>
</template>

<script setup>
import { $Http } from '@/plugins/http';

// 响应式数据
const $Data = $ref({
    loading: false,
    userList: [],
    pagination: {
        current: 1,
        pageSize: 10,
        total: 0
    },
    searchKeyword: '',
    searchState: undefined,
    stateOptions: [
        { label: '正常', value: 1 },
        { label: '禁用', value: 2 },
        { label: '已删除', value: 0 }
    ],
    roleVisible: false,
    currentUser: {},
    columns: [
        { colKey: 'username', title: '用户名', width: 150 },
        { colKey: 'email', title: '邮箱', width: 200 },
        { colKey: 'nickname', title: '昵称', width: 150 },
        { colKey: 'state', title: '状态', width: 100 },
        { colKey: 'roleCode', title: '角色', width: 120 },
        { colKey: 'lastLoginTime', title: '最后登录', width: 180 },
        { colKey: 'operation', title: '操作', width: 200, fixed: 'right' }
    ],
    roleOptions: [],
    checkedRoleCode: ''
});

// 方法集合
const $Method = {
    // 加载用户列表
    async loadUserList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/list', {
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
    onPageChange(pageInfo) {
        $Data.pagination.current = pageInfo.current;
        $Data.pagination.pageSize = pageInfo.pageSize;
        $Method.loadUserList();
    },

    // 搜索
    handleSearch() {
        $Data.pagination.current = 1;
        $Method.loadUserList();
    },

    // 重置
    handleReset() {
        $Data.searchKeyword = '';
        $Data.searchState = undefined;
        $Data.pagination.current = 1;
        $Method.loadUserList();
    },

    // 添加管理员
    handleAdd() {
        MessagePlugin.info('添加管理员功能待开发');
    },

    // 编辑管理员
    handleEdit(row) {
        MessagePlugin.info(`编辑管理员：${row.username}`);
    },

    // 删除管理员
    handleDelete(row) {
        DialogPlugin.confirm({
            header: '确认删除',
            body: `确定要删除管理员 "${row.username}" 吗？`,
            onConfirm: async () => {
                try {
                    // TODO: 调用删除接口
                    MessagePlugin.success('删除成功');
                    await $Method.loadUserList();
                } catch (error) {
                    MessagePlugin.error('删除失败');
                    console.error(error);
                }
            }
        });
    },

    // 加载角色列表
    async loadRoleList() {
        try {
            const res = await $Http('/addon/admin/role/list', {});
            if (res.code === 0 && res.data) {
                // getList 返回分页对象
                const roleList = res.data.list || res.data || [];
                $Data.roleOptions = roleList
                    .filter((role) => role.state === 1)
                    .map((role) => ({
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
    async handleRole(row) {
        $Data.currentUser = row;
        $Data.roleVisible = true;

        // 加载角色列表
        await $Method.loadRoleList();

        // 加载该用户已有的角色
        try {
            const res = await $Http('/addon/admin/roleDetail', { adminId: row.id });
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
            const res = await $Http('/addon/admin/roleSave', {
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
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow: hidden; // 防止外层滚动
}

// 上：工具栏
.toolbar {
    flex-shrink: 0; // 不允许收缩
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: $bg-color-container;
    border-radius: $border-radius;
    box-shadow: $shadow-card;

    .toolbar-left {
        display: flex;
        gap: 12px;
    }

    .toolbar-right {
        display: flex;
        gap: 12px;
    }
}

// 中：表格区域（撑满剩余空间并支持滚动）
.table-wrapper {
    flex: 1; // 占据剩余空间
    overflow: hidden; // 隐藏超出部分
    display: flex;
    flex-direction: column;
    background: $bg-color-container;
    border-radius: $border-radius;
    box-shadow: $shadow-card;
}

// 下：分页栏
.pagination-wrapper {
    flex-shrink: 0; // 不允许收缩
    display: flex;
    justify-content: flex-end;
    padding: 16px;
    background: $bg-color-container;
    border-radius: $border-radius;
    box-shadow: $shadow-card;
}

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
