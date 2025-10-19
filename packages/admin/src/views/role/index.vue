<template>
    <div class="role-page">
        <!-- 上：工具栏 -->
        <div class="toolbar">
            <div class="left">
                <tiny-button type="primary" @click="$Method.handleAdd">
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

        <!-- 中：数据表格 -->
        <tiny-grid :data="$Data.roleList" height="calc(100vh - 240px)" :pager="$Data.pagerConfig" @page-change="$Method.handlePageChange">
            <template #toolbar>
                <div></div>
            </template>
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
            <tiny-grid-column title="操作" :width="260">
                <template #default="{ row }">
                    <tiny-dropdown title="操作" trigger="click" border visible-arrow @item-click="(data) => $Method.handleOperation(data, row)">
                        <template #dropdown>
                            <tiny-dropdown-menu>
                                <tiny-dropdown-item :item-data="{ command: 'edit' }">
                                    <Icon name="Edit" :size="16" style="margin-right: 8px; vertical-align: middle" />
                                    编辑
                                </tiny-dropdown-item>
                                <tiny-dropdown-item :item-data="{ command: 'menu' }">
                                    <Icon name="Settings" :size="16" style="margin-right: 8px; vertical-align: middle" />
                                    菜单权限
                                </tiny-dropdown-item>
                                <tiny-dropdown-item :item-data="{ command: 'delete' }" divided>
                                    <Icon name="Trash2" :size="16" style="margin-right: 8px; vertical-align: middle" />
                                    删除
                                </tiny-dropdown-item>
                            </tiny-dropdown-menu>
                        </template>
                    </tiny-dropdown>
                </template>
            </tiny-grid-column>
        </tiny-grid>

        <!-- 下：分页器 -->
        <div class="pagination">
            <tiny-pager :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.handlePageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-model:visible="$Data.editVisible" :is-edit="$Data.isEdit" :role-data="$Data.currentRole" @success="$Method.loadRoleList" />

        <!-- 菜单权限对话框 -->
        <tiny-dialog-box v-model:visible="$Data.menuVisible" title="菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh">
            <tiny-tree :data="$Data.menuTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'name', children: 'children' }" :ref="(el) => ($Data.menuTreeRef = el)" />
            <template #footer>
                <tiny-button @click="$Data.menuVisible = false">取消</tiny-button>
                <tiny-button type="primary" @click="$Method.handleSaveMenu">保存</tiny-button>
            </template>
        </tiny-dialog-box>
    </div>
</template>

<script setup>
import EditDialog from './components/edit.vue';

// 响应式数据
const $Data = $ref({
    roleList: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 10,
        total: 0
    },
    // 编辑对话框
    editVisible: false,
    isEdit: false,
    currentRole: null,
    // 菜单权限对话框
    menuVisible: false,
    currentRoleId: '',
    menuTreeData: [],
    menuTreeRef: null
});

// 方法
const $Method = {
    // 加载角色列表
    async loadRoleList() {
        try {
            const res = await $Http('/addon/admin/roleList', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });

            if (res.code === 0) {
                // roleList 接口返回的是数组，不是分页对象
                if (Array.isArray(res.data)) {
                    $Data.roleList = res.data;
                    $Data.pagerConfig.total = res.data.length;
                } else if (res.data && res.data.list) {
                    // 如果返回的是分页对象
                    $Data.roleList = res.data.list || [];
                    $Data.pagerConfig.total = res.data.total || 0;
                } else {
                    $Data.roleList = [];
                    $Data.pagerConfig.total = 0;
                }
            }
        } catch (error) {
            console.error('加载角色列表失败:', error);
            Modal.message({ message: '加载数据失败', status: 'error' });
        }
    },

    // 添加角色
    handleAdd() {
        $Data.isEdit = false;
        $Data.currentRole = null;
        $Data.editVisible = true;
    },

    // 编辑角色
    handleEdit(row) {
        $Data.isEdit = true;
        $Data.currentRole = { ...row };
        $Data.editVisible = true;
    },

    // 删除角色
    async handleDelete(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除角色"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/roleDelete', { id: row.id });
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

    // 构建菜单树
    buildMenuTree(list, pid = 0) {
        const result = [];

        for (const item of list) {
            if (item.pid === pid) {
                const node = {
                    id: item.id,
                    name: item.name,
                    children: $Method.buildMenuTree(list, item.id)
                };
                result.push(node);
            }
        }

        return result;
    },

    // 加载菜单树
    async loadMenuTree() {
        try {
            const res = await $Http('/addon/admin/menuList');
            if (res.code === 0) {
                // menuList 接口返回的是数组，不是分页对象
                const menuList = Array.isArray(res.data) ? res.data : res.data.list || [];
                $Data.menuTreeData = $Method.buildMenuTree(menuList);
            }
        } catch (error) {
            console.error('加载菜单失败:', error);
            Modal.message({ message: '加载菜单失败', status: 'error' });
        }
    },

    // 打开菜单权限对话框
    async handleMenu(row) {
        $Data.currentRoleId = row.id;
        $Data.menuVisible = true;

        // 加载菜单树
        await $Method.loadMenuTree();

        // 加载该角色已分配的菜单
        try {
            const res = await $Http('/addon/admin/roleMenuGet', { roleId: row.id });
            if (res.code === 0) {
                // 设置选中的菜单节点
                const checkedKeys = Array.isArray(res.data) ? res.data : [];
                nextTick(() => {
                    $Data.menuTreeRef && $Data.menuTreeRef.setCheckedKeys(checkedKeys);
                });
            }
        } catch (error) {
            console.error('加载角色菜单失败:', error);
        }
    },

    // 保存菜单权限
    async handleSaveMenu() {
        try {
            // 获取选中的节点（包括半选中的父节点）
            const checkedKeys = $Data.menuTreeRef.getCheckedKeys();
            const halfCheckedKeys = $Data.menuTreeRef.getHalfCheckedKeys();
            const menuIds = [...checkedKeys, ...halfCheckedKeys];

            const res = await $Http('/addon/admin/roleMenuSave', {
                roleId: $Data.currentRoleId,
                menuIds
            });

            if (res.code === 0) {
                Modal.message({ message: '保存成功', status: 'success' });
                $Data.menuVisible = false;
            } else {
                Modal.message({ message: res.msg || '保存失败', status: 'error' });
            }
        } catch (error) {
            console.error('保存失败:', error);
            Modal.message({ message: '保存失败', status: 'error' });
        }
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

    // 每页数量改变
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.pageSize = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.loadRoleList();
    },

    // 操作菜单点击
    handleOperation(data, row) {
        const command = data.itemData?.command || data.command;
        switch (command) {
            case 'edit':
                $Method.handleEdit(row);
                break;
            case 'menu':
                $Method.handleMenu(row);
                break;
            case 'delete':
                $Method.handleDelete(row);
                break;
        }
    }
};

// 初始化加载
$Method.loadRoleList();
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
