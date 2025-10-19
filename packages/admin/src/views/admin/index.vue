<template>
    <div class="page-admin">
        <!-- 上：过滤和操作栏 -->
        <div class="toolbar">
            <div class="toolbar-left">
                <tiny-button type="primary" @click="$Method.handleAdd">
                    <template #icon>
                        <icon-plus />
                    </template>
                    添加管理员
                </tiny-button>
            </div>
            <div class="toolbar-right">
                <div class="toolbar-search">
                    <tiny-input v-model="$Data.searchKeyword" placeholder="搜索用户名/邮箱" clearable @keyup.enter="$Method.handleSearch" style="width: 200px" />
                    <tiny-select v-model="$Data.searchState" placeholder="状态" clearable :options="$Data.stateOptions" @change="$Method.handleSearch" style="width: 120px" />
                    <tiny-button @click="$Method.handleSearch">
                        <template #icon>
                            <icon-search />
                        </template>
                        搜索
                    </tiny-button>
                    <tiny-button @click="$Method.handleReset">
                        <template #icon>
                            <icon-refresh />
                        </template>
                        重置
                    </tiny-button>
                </div>
            </div>
        </div>

        <!-- 下：数据表格（包含内置分页） -->
        <div class="table-wrapper">
            <tiny-grid :data="$Data.userList" :loading="$Data.loading" :pager-config="$Data.pagerConfig" border auto-resize max-height="100%" @page-change="$Method.handlePageChange">
                <tiny-grid-column field="username" title="用户名" :width="150" />
                <tiny-grid-column field="email" title="邮箱" :width="200" />
                <tiny-grid-column field="nickname" title="昵称" :width="150" />
                <tiny-grid-column field="state" title="状态" :width="100">
                    <template #default="{ row }">
                        <tiny-tag v-if="row.state === 1" type="success">正常</tiny-tag>
                        <tiny-tag v-else-if="row.state === 2" type="warning">禁用</tiny-tag>
                        <tiny-tag v-else type="danger">已删除</tiny-tag>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column field="roleCode" title="角色" :width="120" />
                <tiny-grid-column field="lastLoginTime" title="最后登录" :width="180">
                    <template #default="{ row }">
                        <span v-if="row.lastLoginTime">{{ new Date(Number(row.lastLoginTime)).toLocaleString() }}</span>
                        <span v-else>-</span>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column title="操作" :width="200" fixed="right">
                    <template #default="{ row }">
                        <div class="operation-buttons">
                            <tiny-button text type="primary" @click="$Method.handleRole(row)">分配角色</tiny-button>
                            <tiny-button text type="warning" @click="$Method.handleEdit(row)">编辑</tiny-button>
                            <tiny-button text type="danger" @click="$Method.handleDelete(row)">删除</tiny-button>
                        </div>
                    </template>
                </tiny-grid-column>
            </tiny-grid>
        </div>

        <!-- 角色分配对话框 -->
        <tiny-dialog-box v-model:visible="$Data.roleVisible" title="分配角色" width="600px" :append-to-body="true" @confirm="$Method.handleRoleSubmit">
            <div class="role-dialog">
                <div class="user-info">
                    <tiny-tag type="info">{{ $Data.currentUser.username }}</tiny-tag>
                    <span class="user-email">{{ $Data.currentUser.email }}</span>
                </div>
                <tiny-divider />
                <tiny-select v-model="$Data.checkedRoleCode" :options="$Data.roleOptions" placeholder="请选择角色" />
            </div>
        </tiny-dialog-box>
    </div>
</template>

<script setup lang="ts">
import { Modal } from '@opentiny/vue';
import { iconSearch, iconRefresh, iconPlus } from '@opentiny/vue-icon';

// 响应式数据
const $Data = $ref({
    loading: false,
    userList: [] as any[],
    searchKeyword: '',
    searchState: undefined as number | undefined,
    stateOptions: [
        { label: '正常', value: 1 },
        { label: '禁用', value: 2 },
        { label: '已删除', value: 0 }
    ],
    roleVisible: false,
    currentUser: {} as any,
    roleOptions: [] as any[],
    checkedRoleCode: '' as string,
    // Grid 内置分页配置
    pagerConfig: {
        currentPage: 1,
        pageSize: 10,
        total: 0,
        pageSizes: [10, 20, 50, 100],
        layout: 'total, prev, pager, next, sizes, jumper'
    }
});

// 方法集合
const $Method = {
    // 处理分页改变事件
    handlePageChange({ currentPage, pageSize }: { currentPage: number; pageSize: number }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Data.pagerConfig.pageSize = pageSize;
        $Method.loadUserList();
    },

    // 加载用户列表
    async loadUserList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/adminList', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            if (res.code === 0 && res.data) {
                // getList 返回分页对象 { list, total, page, limit, pages }
                $Data.userList = res.data.list || [];
                $Data.pagerConfig.total = res.data.total || 0;
            }
        } catch (error) {
            Modal.message({ message: '加载用户列表失败', status: 'error' });
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 搜索
    handleSearch() {
        $Data.pagerConfig.currentPage = 1;
        $Method.loadUserList();
    },

    // 重置
    handleReset() {
        $Data.searchKeyword = '';
        $Data.searchState = undefined;
        $Data.pagerConfig.currentPage = 1;
        $Method.loadUserList();
    },

    // 添加管理员
    handleAdd() {
        Modal.message({ message: '添加管理员功能待开发', status: 'info' });
    },

    // 编辑管理员
    handleEdit(row: any) {
        Modal.message({ message: `编辑管理员：${row.username}`, status: 'info' });
    },

    // 删除管理员
    handleDelete(row: any) {
        Modal.confirm({
            message: `确定要删除管理员 "${row.username}" 吗？`,
            title: '确认删除'
        }).then(async (res: string) => {
            if (res === 'confirm') {
                try {
                    // TODO: 调用删除接口
                    Modal.message({ message: '删除成功', status: 'success' });
                    await $Method.loadUserList();
                } catch (error) {
                    Modal.message({ message: '删除失败', status: 'error' });
                    console.error(error);
                }
            }
        });
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
            Modal.message({ message: '加载角色列表失败', status: 'error' });
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
            Modal.message({ message: '加载用户角色失败', status: 'error' });
            console.error(error);
        }
    },

    // 提交角色分配
    async handleRoleSubmit() {
        if (!$Data.checkedRoleCode) {
            Modal.message({ message: '请选择角色', status: 'warning' });
            return false;
        }

        try {
            const res = await $Http('/addon/admin/adminRoleSave', {
                adminId: $Data.currentUser.id,
                roleCode: $Data.checkedRoleCode
            });

            if (res.code === 0) {
                Modal.message({ message: '角色分配成功', status: 'success' });
                $Data.roleVisible = false;
                await $Method.loadUserList();
                return true;
            } else {
                Modal.message({ message: res.msg || '分配失败', status: 'error' });
                return false;
            }
        } catch (error) {
            Modal.message({ message: '分配失败', status: 'error' });
            console.error(error);
            return false;
        }
    }
};

// 初始化加载
$Method.loadUserList();
</script>

<style scoped lang="scss">
.page-admin {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow: hidden;
}

// 上：工具栏
.toolbar {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .toolbar-left {
        display: flex;
        gap: 12px;
    }

    .toolbar-right {
        display: flex;
        gap: 12px;
    }

    .toolbar-search {
        display: flex;
        gap: 12px;
        align-items: center;
    }
}

// 下：表格区域（包含内置分页）
.table-wrapper {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.role-dialog {
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .user-email {
            color: var(--ti-common-color-text-secondary);
        }
    }
}

.operation-buttons {
    display: flex;
    gap: 8px;
}
</style>
