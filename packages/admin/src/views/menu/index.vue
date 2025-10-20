<template>
    <div class="page-menu page-table">
        <div class="main-tool">
            <div class="left">
                <tiny-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <Icon name="Plus" :size="16" />
                    </template>
                    添加菜单
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
            <tiny-grid :data="$Data.menuList" header-cell-class-name="custom-table-cell-class" size="small" height="100%" seq-serial>
                <tiny-grid-column type="index" title="序号" :width="60" />
                <tiny-grid-column field="name" title="菜单名称" />
                <tiny-grid-column field="path" title="路径" :width="200" />
                <tiny-grid-column field="icon" title="图标" :width="100">
                    <template #default="{ row }">
                        <Icon v-if="row.icon" :name="row.icon" :size="16" />
                        <span v-else>-</span>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column field="type" title="类型" :width="100">
                    <template #default="{ row }">
                        <tiny-tag v-if="row.type === 0" type="info">目录</tiny-tag>
                        <tiny-tag v-else type="success">菜单</tiny-tag>
                    </template>
                </tiny-grid-column>
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
        <EditDialog v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.loadMenuList" />
    </div>
</template>

<script setup>
import EditDialog from './components/edit.vue';

// 响应式数据
const $Data = $ref({
    menuList: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    // 加载菜单列表
    async loadMenuList() {
        try {
            const res = await $Http('/addon/admin/menuList', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.menuList = res.data.list || res.data || [];
            $Data.pagerConfig.total = res.data.total || $Data.menuList.length;
        } catch (error) {
            console.error('加载菜单列表失败:', error);
            Modal.message({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除菜单
    async handleDelete(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除菜单"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/menuDelete', { id: row.id });
                if (res.code === 0) {
                    Modal.message({ message: '删除成功', status: 'success' });
                    $Method.loadMenuList();
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
        $Method.loadMenuList();
    },

    // 分页改变
    handlePageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.loadMenuList();
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'edit') {
            $Data.editVisible = true;
        } else if (command === 'delete') {
            $Method.handleDelete(rowData);
        }
    }
};

onMounted(() => {
    $Method.loadMenuList();
});
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
