<template>
    <div class="page-role page-table">
        <div class="main-tool">
            <div class="left">
                <tiny-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <Icon name="Plus" :size="16" />
                    </template>
                    添加角色
                </tiny-button>
            </div>
            <div class="right">
                <tiny-button @click="$Method.handleRefresh">
                    <template #icon>
                        <Icon name="RotateCw" :size="16" />
                    </template>
                    刷新
                </tiny-button>
            </div>
        </div>
        <div class="main-table">
            <tiny-grid :data="$Data.tableData" header-cell-class-name="custom-table-cell-class" size="small" height="100%" seq-serial>
                <tiny-grid-column type="index" title="序号" :width="60" />
                <tiny-grid-column field="name" title="角色名称" />
                <tiny-grid-column field="code" title="角色代码" :width="150" />
                <tiny-grid-column field="description" title="描述" />
                <tiny-grid-column field="sort" title="排序" :width="80" />
                <tiny-grid-column field="state" title="状态" :width="100">
                    <template #default="{ row }">
                        <tiny-tag v-if="row.state === 1" type="success">正常</tiny-tag>
                        <tiny-tag v-else-if="row.state === 2" type="warning">禁用</tiny-tag>
                        <tiny-tag v-else type="danger">已删除</tiny-tag>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column title="操作" :width="120" align="right">
                    <template #default="{ row }">
                        <tiny-dropdown title="操作" trigger="click" size="small" border visible-arrow @item-click="(data) => $Method.onAction(data.itemData.command, row)">
                            <template #dropdown>
                                <tiny-dropdown-menu>
                                    <tiny-dropdown-item :item-data="{ command: 'edit' }">
                                        <Icon name="Edit" />
                                        编辑
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'menu' }">
                                        <Icon name="Settings" />
                                        菜单权限
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'delete' }" divided>
                                        <Icon name="Trash2" />
                                        删除
                                    </tiny-dropdown-item>
                                </tiny-dropdown-menu>
                            </template>
                        </tiny-dropdown>
                    </template>
                </tiny-grid-column>
            </tiny-grid>
        </div>

        <div class="main-page">
            <tiny-pager :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.handlePageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.loadRoleList" />

        <!-- 菜单权限对话框组件 -->
        <MenuDialog v-model="$Data.menuVisible" :row-data="$Data.rowData" @success="$Method.loadRoleList" />
    </div>
</template>

<script setup>
import EditDialog from './components/edit.vue';
import MenuDialog from './components/menu.vue';

// 响应式数据
const $Data = $ref({
    tableData: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    menuVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    // 加载角色列表
    async loadRoleList() {
        try {
            const res = await $Http('/addon/admin/roleList', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载角色列表失败:', error);
            Modal.message({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除角色
    async handleDelete(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除角色"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/roleDel', { id: row.id });
                if (res.code === 0) {
                    Modal.message({ message: '删除成功', status: 'success' });
                    $Method.loadRoleList();
                } else {
                    Modal.message({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                Modal.message({ message: '删除失败', status: 'error' });
            }
        });
    },

    // 刷新
    handleRefresh() {
        $Method.loadRoleList();
    },

    // 分页改变
    handlePageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.loadRoleList();
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'edit') {
            $Data.editVisible = true;
        } else if (command === 'menu') {
            $Data.menuVisible = true;
        } else if (command === 'delete') {
            $Method.handleDelete(rowData);
        }
    }
};

onMounted(() => {
    $Method.loadRoleList();
});
</script>

<style scoped lang="scss">
.role-page {
    padding: 16px;

    .toolbar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;
        padding: 16px;
        background: #fff;
        border-radius: 4px;

        .left,
        .right {
            display: flex;
            gap: 8px;
        }
    }

    .pagination {
        margin-top: 16px;
        padding: 16px;
        background: #fff;
        border-radius: 4px;
        display: flex;
        justify-content: flex-end;
    }
}
</style>
