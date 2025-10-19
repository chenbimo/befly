<template>
    <div class="role-manage">
        <t-card title="角色管理" :bordered="false">
            <template #actions>
                <t-button theme="primary" @click="$Method.handleAdd()">
                    <template #icon><add-icon /></template>
                    添加角色
                </t-button>
            </template>

            <t-table :data="$Data.roleList" :columns="$Data.columns" row-key="id" :loading="$Data.loading">
                <template #status="{ row }">
                    <t-tag v-if="row.status === 1" theme="success">启用</t-tag>
                    <t-tag v-else theme="danger">禁用</t-tag>
                </template>

                <template #operation="{ row }">
                    <t-space>
                        <t-link theme="primary" @click="$Method.handleEdit(row)">编辑</t-link>
                        <t-link theme="primary" @click="$Method.handlePermission(row)">权限</t-link>
                        <t-popconfirm content="确认删除该角色吗？" @confirm="$Method.handleDelete(row.id)">
                            <t-link theme="danger">删除</t-link>
                        </t-popconfirm>
                    </t-space>
                </template>
            </t-table>
        </t-card>

        <!-- 添加/编辑对话框 -->
        <t-dialog v-model:visible="$Data.dialogVisible" :header="$Data.isEdit ? '编辑角色' : '添加角色'" width="600px" :on-confirm="$Method.handleSubmit">
            <t-form :ref="(el: any) => ($Form.roleForm = el)" :data="$Data.formData" :rules="$Data.formRules" label-width="80px">
                <t-form-item label="角色名称" name="name">
                    <t-input v-model="$Data.formData.name" placeholder="请输入角色名称" />
                </t-form-item>

                <t-form-item label="角色代码" name="code">
                    <t-input v-model="$Data.formData.code" placeholder="请输入角色代码，如：admin" />
                </t-form-item>

                <t-form-item label="角色描述" name="description">
                    <t-textarea v-model="$Data.formData.description" placeholder="请输入角色描述" :autosize="{ minRows: 3, maxRows: 5 }" />
                </t-form-item>

                <t-form-item label="排序" name="sort">
                    <t-input-number v-model="$Data.formData.sort" :min="0" />
                </t-form-item>

                <t-form-item label="状态" name="status">
                    <t-radio-group v-model="$Data.formData.status">
                        <t-radio :value="1">启用</t-radio>
                        <t-radio :value="0">禁用</t-radio>
                    </t-radio-group>
                </t-form-item>
            </t-form>
        </t-dialog>

        <!-- 权限分配对话框 -->
        <t-dialog v-model:visible="$Data.permissionVisible" header="分配菜单权限" width="600px" :on-confirm="$Method.handlePermissionSubmit">
            <div class="permission-dialog">
                <div class="role-info">
                    <t-tag theme="primary">{{ $Data.currentRole.name }}</t-tag>
                    <span class="role-code">{{ $Data.currentRole.code }}</span>
                </div>
                <t-divider />
                <t-tree :ref="(el: any) => ($Form.menuTree = el)" :data="$Data.menuTreeData" :keys="{ value: 'id', label: 'name', children: 'children' }" checkable expand-all v-model:checked="$Data.checkedMenuIds" :loading="$Data.menuLoading" />
            </div>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
// 响应式表单引用
const $Form = $ref({
    roleForm: null as any,
    menuTree: null as any
});

// 响应式数据
const $Data = $ref({
    loading: false,
    menuLoading: false,
    roleList: [] as any[],
    dialogVisible: false,
    permissionVisible: false,
    isEdit: false,
    currentRole: {} as any,
    formData: {
        id: 0,
        name: '',
        code: '',
        description: '',
        sort: 0,
        status: 1
    },
    columns: [
        { colKey: 'name', title: '角色名称', width: 150 },
        { colKey: 'code', title: '角色代码', width: 150 },
        { colKey: 'description', title: '角色描述', ellipsis: true },
        { colKey: 'sort', title: '排序', width: 80 },
        { colKey: 'status', title: '状态', width: 80 },
        { colKey: 'operation', title: '操作', width: 200, fixed: 'right' }
    ],
    formRules: {
        name: [{ required: true, message: '请输入角色名称', type: 'error' }],
        code: [
            { required: true, message: '请输入角色代码', type: 'error' },
            { pattern: /^[a-z_]+$/, message: '角色代码只能包含小写字母和下划线', type: 'error' }
        ]
    },
    menuTreeData: [] as any[],
    checkedMenuIds: [] as number[]
});

// 方法集合
const $Method = {
    // 加载角色列表
    async loadRoleList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/roleList', {});
            if (res.code === 0 && res.data) {
                $Data.roleList = res.data;
            }
        } catch (error) {
            MessagePlugin.error('加载角色列表失败');
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 加载菜单树
    async loadMenuTree() {
        $Data.menuLoading = true;
        try {
            const res = await $Http('/addon/admin/menuList', {});
            if (res.code === 0 && res.data) {
                $Data.menuTreeData = $Method.buildMenuTree(res.data);
            }
        } catch (error) {
            MessagePlugin.error('加载菜单列表失败');
            console.error(error);
        } finally {
            $Data.menuLoading = false;
        }
    },

    // 构建树形结构
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

    // 添加角色
    handleAdd() {
        $Data.isEdit = false;
        $Data.formData = {
            id: 0,
            name: '',
            code: '',
            description: '',
            sort: 0,
            status: 1
        };
        $Data.dialogVisible = true;
    },

    // 编辑角色
    handleEdit(row: any) {
        $Data.isEdit = true;
        $Data.formData = { ...row };
        $Data.dialogVisible = true;
    },

    // 提交表单
    async handleSubmit() {
        const valid = await $Form.roleForm.validate();
        if (!valid) return false;

        try {
            const apiUrl = $Data.isEdit ? '/addon/admin/roleUpdate' : '/addon/admin/roleCreate';
            const res = await $Http(apiUrl, $Data.formData);

            if (res.code === 0) {
                MessagePlugin.success($Data.isEdit ? '更新成功' : '创建成功');
                $Data.dialogVisible = false;
                await $Method.loadRoleList();
                return true;
            } else {
                MessagePlugin.error(res.msg || '操作失败');
                return false;
            }
        } catch (error) {
            MessagePlugin.error('操作失败');
            console.error(error);
            return false;
        }
    },

    // 删除角色
    async handleDelete(id: number) {
        try {
            const res = await $Http('/addon/admin/roleDelete', { id });
            if (res.code === 0) {
                MessagePlugin.success('删除成功');
                await $Method.loadRoleList();
            } else {
                MessagePlugin.error(res.msg || '删除失败');
            }
        } catch (error) {
            MessagePlugin.error('删除失败');
            console.error(error);
        }
    },

    // 打开权限分配对话框
    async handlePermission(row: any) {
        $Data.currentRole = row;
        $Data.permissionVisible = true;

        // 加载菜单树
        await $Method.loadMenuTree();

        // 加载该角色已有的权限
        try {
            const res = await $Http('/addon/admin/roleMenuGet', { roleId: row.id });
            if (res.code === 0 && res.data) {
                $Data.checkedMenuIds = res.data;
            }
        } catch (error) {
            MessagePlugin.error('加载权限失败');
            console.error(error);
        }
    },

    // 提交权限分配
    async handlePermissionSubmit() {
        try {
            const res = await $Http('/addon/admin/roleMenuSave', {
                roleId: $Data.currentRole.id,
                menuIds: JSON.stringify($Data.checkedMenuIds)
            });

            if (res.code === 0) {
                MessagePlugin.success('权限保存成功');
                $Data.permissionVisible = false;
                return true;
            } else {
                MessagePlugin.error(res.msg || '保存失败');
                return false;
            }
        } catch (error) {
            MessagePlugin.error('保存失败');
            console.error(error);
            return false;
        }
    }
};

// 初始化加载
$Method.loadRoleList();
</script>

<style scoped lang="scss">
.role-manage {
    padding: 20px;
}

.permission-dialog {
    .role-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .role-code {
            color: var(--td-text-color-secondary);
            font-family: monospace;
        }
    }
}
</style>
