<template>
    <div class="page-data">
        <!-- 上：过滤和操作栏 -->
        <div class="main-toolbar">
            <div class="toolbar-left">
                <tiny-button type="primary" @click="$Method.handleAdd">
                    <template #icon>
                        <Icon name="Plus" :size="16" />
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
                            <Icon name="Search" :size="16" />
                        </template>
                        搜索
                    </tiny-button>
                    <tiny-button @click="$Method.handleReset">
                        <template #icon>
                            <Icon name="RotateCw" :size="16" />
                        </template>
                        重置
                    </tiny-button>
                </div>
            </div>
        </div>

        <!-- 中：数据表格 -->
        <div class="main-table">
            <tiny-grid :data="$Data.userList" :loading="$Data.loading" border auto-resize max-height="100%">
                <tiny-grid-column field="username" title="用户名" />
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
                <tiny-grid-column title="操作" :width="120" fixed="right">
                    <template #default="{ row }">
                        <tiny-dropdown title="操作" trigger="click" border visible-arrow @item-click="(data: any) => $Method.handleOperation(data, row)">
                            <template #dropdown>
                                <tiny-dropdown-menu>
                                    <tiny-dropdown-item :item-data="{ command: 'role' }">
                                        <Icon name="User" :size="16" style="margin-right: 8px" />
                                        分配角色
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'edit' }">
                                        <Icon name="Edit" :size="16" style="margin-right: 8px" />
                                        编辑
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'delete' }" divided>
                                        <Icon name="Trash2" :size="16" style="margin-right: 8px" />
                                        删除
                                    </tiny-dropdown-item>
                                </tiny-dropdown-menu>
                            </template>
                        </tiny-dropdown>
                    </template>
                </tiny-grid-column>
            </tiny-grid>
        </div>

        <!-- 下：分页器 -->
        <div class="main-page">
            <tiny-pager v-model:current-page="$Data.pagerConfig.currentPage" v-model:page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" :layout="$Data.pagerConfig.layout" @current-change="$Method.handlePageChange" @size-change="$Method.handlePageChange" />
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
        layout: 'total, prev, pager, next, jumper'
    }
});

// 方法集合
const $Method = {
    // 处理操作下拉菜单
    handleOperation(data: any, row: any) {
        const { command } = data;
        switch (command) {
            case 'role':
                $Method.handleRole(row);
                break;
            case 'edit':
                $Method.handleEdit(row);
                break;
            case 'delete':
                $Method.handleDelete(row);
                break;
        }
    },

    // 处理分页改变事件
    handlePageChange() {
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
    async handleSearch() {
        $Data.pagerConfig.currentPage = 1;
        await $Method.loadUserList(1, $Data.pagerConfig.pageSize);
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
</style>
