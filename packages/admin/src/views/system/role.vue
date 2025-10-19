<template>
    <div class="page-data">
        <!-- 上：过滤和操作栏 -->
        <div class="main-toolbar">
            <div class="toolbar-left">
                <tiny-button type="primary" @click="$Method.handleAdd">
                    <template #icon>
                        <Icon name="Plus" :size="16" />
                    </template>
                    添加角色
                </tiny-button>
            </div>
            <div class="toolbar-right">
                <tiny-input v-model="$Data.searchKeyword" placeholder="搜索角色名称/代码" clearable @keyup.enter="$Method.handleSearch" style="width: 200px" />
                <tiny-button circle @click="$Method.handleSearch" title="搜索">
                    <Icon name="Search" :size="16" />
                </tiny-button>
                <tiny-button circle @click="$Method.handleReset" title="重置">
                    <Icon name="RotateCw" :size="16" />
                </tiny-button>
            </div>
        </div>

        <!-- 中：数据表格 -->
        <div class="main-table">
            <tiny-grid :data="$Data.roleList" :loading="$Data.loading" border auto-resize max-height="100%">
                <tiny-grid-column field="name" title="角色名称" :width="150" />
                <tiny-grid-column field="code" title="角色代码" :width="150" />
                <tiny-grid-column field="description" title="角色描述" />
                <tiny-grid-column field="sort" title="排序" :width="100" />
                <tiny-grid-column field="state" title="状态" :width="100">
                    <template #default="{ row }">
                        <tiny-tag v-if="row.state === 1" type="success">正常</tiny-tag>
                        <tiny-tag v-else-if="row.state === 2" type="warning">禁用</tiny-tag>
                        <tiny-tag v-else type="danger">已删除</tiny-tag>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column title="操作" :width="140" fixed="right">
                    <template #default="{ row }">
                        <tiny-dropdown title="操作" trigger="click" border visible-arrow @item-click="(data: any) => $Method.handleOperation(data, row)">
                            <template #dropdown>
                                <tiny-dropdown-menu>
                                    <tiny-dropdown-item :item-data="{ command: 'menu' }">
                                        <Icon name="List" :size="16" style="margin-right: 8px; vertical-align: middle" />
                                        菜单权限
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'edit' }">
                                        <Icon name="Edit" :size="16" style="margin-right: 8px; vertical-align: middle" />
                                        编辑
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
        </div>

        <!-- 下：分页器 -->
        <div class="main-page">
            <tiny-pager v-model:current-page="$Data.pagerConfig.currentPage" v-model:page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" :layout="$Data.pagerConfig.layout" @current-change="$Method.handlePageChange" @size-change="$Method.handlePageChange" />
        </div>

        <!-- 添加/编辑对话框 -->
        <tiny-dialog-box v-model:visible="$Data.editVisible" :title="$Data.isEdit ? '编辑角色' : '添加角色'" width="600px" :append-to-body="true" :show-footer="true" top="10vh">
            <tiny-form :model="$Data.editForm" label-width="80px" :rules="$Data.editRules" :ref="(el: any) => ($Data.editFormRef = el)">
                <tiny-form-item label="角色名称" prop="name">
                    <tiny-input v-model="$Data.editForm.name" placeholder="请输入角色名称" />
                </tiny-form-item>
                <tiny-form-item label="角色代码" prop="code">
                    <tiny-input v-model="$Data.editForm.code" placeholder="请输入角色代码，如：admin" :disabled="$Data.isEdit" />
                </tiny-form-item>
                <tiny-form-item label="角色描述" prop="description">
                    <tiny-input v-model="$Data.editForm.description" type="textarea" placeholder="请输入角色描述" :rows="3" />
                </tiny-form-item>
                <tiny-form-item label="排序" prop="sort">
                    <tiny-numeric v-model="$Data.editForm.sort" :min="0" :max="9999" />
                </tiny-form-item>
                <tiny-form-item label="状态" prop="state" v-if="$Data.isEdit">
                    <tiny-radio-group v-model="$Data.editForm.state">
                        <tiny-radio :label="1">正常</tiny-radio>
                        <tiny-radio :label="2">禁用</tiny-radio>
                    </tiny-radio-group>
                </tiny-form-item>
            </tiny-form>
            <template #footer>
                <tiny-button @click="$Data.editVisible = false">取消</tiny-button>
                <tiny-button type="primary" @click="$Method.handleEditSubmit">确定</tiny-button>
            </template>
        </tiny-dialog-box>

        <!-- 菜单权限对话框 -->
        <tiny-dialog-box v-model:visible="$Data.menuVisible" title="分配菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh">
            <div class="menu-dialog">
                <div class="role-info">
                    <tiny-tag type="info">{{ $Data.currentRole.name }}</tiny-tag>
                    <span class="role-code">{{ $Data.currentRole.code }}</span>
                </div>
                <tiny-divider />
                <tiny-tree :data="$Data.menuTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'name', children: 'children' }" :ref="(el: any) => ($Data.menuTreeRef = el)" />
            </div>
            <template #footer>
                <tiny-button @click="$Data.menuVisible = false">取消</tiny-button>
                <tiny-button type="primary" @click="$Method.handleMenuSubmit">确定</tiny-button>
            </template>
        </tiny-dialog-box>
    </div>
</template>

<script setup lang="ts">
// 响应式数据
const $Data = $ref({
    loading: false,
    roleList: [] as any[],
    searchKeyword: '',
    // 编辑对话框
    editVisible: false,
    isEdit: false,
    editFormRef: null as any,
    editForm: {
        id: '',
        name: '',
        code: '',
        description: '',
        sort: 0,
        state: 1
    },
    editRules: {
        name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
        code: [
            { required: true, message: '请输入角色代码', trigger: 'blur' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线', trigger: 'blur' }
        ],
        sort: [{ type: 'number', message: '排序必须是数字', trigger: 'blur' }]
    },
    // 菜单权限对话框
    menuVisible: false,
    currentRole: {} as any,
    menuTreeData: [] as any[],
    menuTreeRef: null as any,
    // 分页配置
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
        const command = data.itemData?.command || data.command;
        switch (command) {
            case 'menu':
                $Method.handleMenu(row);
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
        $Method.loadRoleList();
    },

    // 加载角色列表
    async loadRoleList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/roleList', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize,
                keyword: $Data.searchKeyword
            });
            if (res.code === 0 && res.data) {
                // roleList 接口返回的是数组，不是分页对象
                if (Array.isArray(res.data)) {
                    $Data.roleList = res.data;
                    $Data.pagerConfig.total = res.data.length;
                } else if (res.data.list) {
                    // 如果返回的是分页对象
                    $Data.roleList = res.data.list || [];
                    $Data.pagerConfig.total = res.data.total || 0;
                }
            }
        } catch (error) {
            Modal.message({ message: '加载角色列表失败', status: 'error' });
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 搜索
    async handleSearch() {
        $Data.pagerConfig.currentPage = 1;
        await $Method.loadRoleList();
    },

    // 重置
    handleReset() {
        $Data.searchKeyword = '';
        $Data.pagerConfig.currentPage = 1;
        $Method.loadRoleList();
    },

    // 添加角色
    handleAdd() {
        $Data.isEdit = false;
        $Data.editForm = {
            id: '',
            name: '',
            code: '',
            description: '',
            sort: 0,
            state: 1
        };
        $Data.editVisible = true;
    },

    // 编辑角色
    handleEdit(row: any) {
        $Data.isEdit = true;
        $Data.editForm = {
            id: row.id,
            name: row.name,
            code: row.code,
            description: row.description || '',
            sort: row.sort || 0,
            state: row.state
        };
        $Data.editVisible = true;
    },

    // 提交编辑
    async handleEditSubmit() {
        try {
            const valid = await $Data.editFormRef.validate();
            if (!valid) {
                return;
            }

            const apiUrl = $Data.isEdit ? '/addon/admin/roleUpdate' : '/addon/admin/roleCreate';
            const params: any = {
                name: $Data.editForm.name,
                code: $Data.editForm.code,
                description: $Data.editForm.description,
                sort: $Data.editForm.sort
            };

            if ($Data.isEdit) {
                params.id = $Data.editForm.id;
            }

            const res = await $Http(apiUrl, params);

            if (res.code === 0) {
                Modal.message({ message: $Data.isEdit ? '编辑成功' : '创建成功', status: 'success' });
                $Data.editVisible = false;
                await $Method.loadRoleList();
            } else {
                Modal.message({ message: res.msg || '操作失败', status: 'error' });
            }
        } catch (error) {
            Modal.message({ message: '操作失败', status: 'error' });
            console.error(error);
        }
    },

    // 删除角色
    handleDelete(row: any) {
        Modal.confirm({
            message: `确定要删除角色 "${row.name}" 吗？`,
            title: '确认删除',
            top: '20vh'
        }).then(async (res: string) => {
            if (res === 'confirm') {
                try {
                    const result = await $Http('/addon/admin/roleDelete', { id: row.id });
                    if (result.code === 0) {
                        Modal.message({ message: '删除成功', status: 'success' });
                        await $Method.loadRoleList();
                    } else {
                        Modal.message({ message: result.msg || '删除失败', status: 'error' });
                    }
                } catch (error) {
                    Modal.message({ message: '删除失败', status: 'error' });
                    console.error(error);
                }
            }
        });
    },

    // 构建菜单树
    buildMenuTree(list: any[], pid = 0): any[] {
        const result: any[] = [];
        for (const item of list) {
            if (item.pid === pid) {
                const children = $Method.buildMenuTree(list, item.id);
                const node: any = {
                    id: item.id,
                    name: item.name,
                    children: children.length > 0 ? children : undefined
                };
                result.push(node);
            }
        }
        return result;
    },

    // 加载菜单树
    async loadMenuTree() {
        try {
            const res = await $Http('/addon/admin/menuList', {});
            if (res.code === 0 && res.data) {
                // menuList 接口返回的是数组，不是分页对象
                const menuList = Array.isArray(res.data) ? res.data : res.data.list || [];
                $Data.menuTreeData = $Method.buildMenuTree(menuList);
            }
        } catch (error) {
            Modal.message({ message: '加载菜单列表失败', status: 'error' });
            console.error(error);
        }
    },

    // 打开菜单权限对话框
    async handleMenu(row: any) {
        $Data.currentRole = row;
        $Data.menuVisible = true;

        // 加载菜单树
        await $Method.loadMenuTree();

        // 加载该角色已有的菜单权限
        try {
            const res = await $Http('/addon/admin/roleMenuGet', { roleId: row.id });
            if (res.code === 0 && res.data) {
                // 设置选中的菜单节点
                const checkedKeys = Array.isArray(res.data) ? res.data : [];
                setTimeout(() => {
                    if ($Data.menuTreeRef && $Data.menuTreeRef.setCheckedKeys) {
                        $Data.menuTreeRef.setCheckedKeys(checkedKeys);
                    }
                }, 100);
            }
        } catch (error) {
            Modal.message({ message: '加载菜单权限失败', status: 'error' });
            console.error(error);
        }
    },

    // 提交菜单权限分配
    async handleMenuSubmit() {
        try {
            // 获取选中的节点（包括半选中的父节点）
            const checkedKeys = $Data.menuTreeRef.getCheckedKeys();
            const halfCheckedKeys = $Data.menuTreeRef.getHalfCheckedKeys();
            const allKeys = [...checkedKeys, ...halfCheckedKeys];

            const res = await $Http('/addon/admin/roleMenuSave', {
                roleId: $Data.currentRole.id,
                menuIds: JSON.stringify(allKeys)
            });

            if (res.code === 0) {
                Modal.message({ message: '菜单权限保存成功', status: 'success' });
                $Data.menuVisible = false;
            } else {
                Modal.message({ message: res.msg || '保存失败', status: 'error' });
            }
        } catch (error) {
            Modal.message({ message: '保存失败', status: 'error' });
            console.error(error);
        }
    }
};

// 初始化加载
$Method.loadRoleList();
</script>

<style scoped lang="scss">
.menu-dialog {
    .role-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .role-code {
            color: var(--ti-common-color-text-secondary);
            font-family: monospace;
        }
    }
}
</style>
