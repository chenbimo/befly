<template>
    <div class="menu-manage">
        <t-card title="菜单管理" :bordered="false">
            <template #actions>
                <t-button theme="primary" @click="$Method.handleAdd()">
                    <template #icon><add-icon /></template>
                    添加菜单
                </t-button>
            </template>

            <t-table :data="$Data.menuList" :columns="$Data.columns" row-key="id" :tree="{ childrenKey: 'children', defaultExpandAll: true }" :loading="$Data.loading">
                <template #icon="{ row }">
                    <component :is="$Method.getIcon(row.icon)" v-if="row.icon" />
                    <span v-else class="text-placeholder">无</span>
                </template>

                <template befly="{ row }">
                    <t-tag v-if="row.type === 1" theme="primary">菜单</t-tag>
                    <t-tag v-else theme="default">目录</t-tag>
                </template>

                <template #status="{ row }">
                    <t-tag v-if="row.status === 1" theme="success">启用</t-tag>
                    <t-tag v-else theme="danger">禁用</t-tag>
                </template>

                <template #operation="{ row }">
                    <t-space>
                        <t-link theme="primary" @click="$Method.handleEdit(row)">编辑</t-link>
                        <t-popconfirm content="确认删除该菜单吗？" @confirm="$Method.handleDelete(row.id)">
                            <t-link theme="danger">删除</t-link>
                        </t-popconfirm>
                    </t-space>
                </template>
            </t-table>
        </t-card>

        <!-- 添加/编辑对话框 -->
        <t-dialog v-model:visible="$Data.dialogVisible" :header="$Data.isEdit ? '编辑菜单' : '添加菜单'" width="600px" :on-confirm="$Method.handleSubmit">
            <t-form :ref="(el: any) => ($Form.menuForm = el)" :data="$Data.formData" :rules="$Data.formRules" label-width="80px">
                <t-form-item label="上级菜单" name="pid">
                    <t-tree-select v-model="$Data.formData.pid" :data="$Data.menuTreeOptions" :tree-props="{ keys: { value: 'id', label: 'name', children: 'children' } }" clearable placeholder="选择上级菜单（不选则为顶级）" />
                </t-form-item>

                <t-form-item label="菜单名称" name="name">
                    <t-input v-model="$Data.formData.name" placeholder="请输入菜单名称" />
                </t-form-item>

                <t-form-item label="路由路径" name="path">
                    <t-input v-model="$Data.formData.path" placeholder="请输入路由路径，如：/user" />
                </t-form-item>

                <t-form-item label="菜单图标" name="icon">
                    <t-select v-model="$Data.formData.icon" clearable placeholder="选择图标">
                        <t-option v-for="icon in $Data.iconOptions" :key="icon.value" :value="icon.value" :label="icon.label">
                            <div style="display: flex; align-items: center; gap: 8px">
                                <component :is="$Method.getIcon(icon.value)" />
                                <span>{{ icon.label }}</span>
                            </div>
                        </t-option>
                    </t-select>
                </t-form-item>

                <t-form-item label="菜单类型" name="type">
                    <t-radio-group v-model="$Data.formData.type">
                        <t-radio :value="0">目录</t-radio>
                        <t-radio :value="1">菜单</t-radio>
                    </t-radio-group>
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
    </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue';

// 图标映射
const iconMap: Record<string, any> = {
    UserIcon: markRaw(UserIcon),
    DashboardIcon: markRaw(DashboardIcon),
    SettingIcon: markRaw(SettingIcon),
    ViewListIcon: markRaw(ViewListIcon),
    FolderOpenIcon: markRaw(FolderOpenIcon),
    AppIcon: markRaw(AppIcon),
    RootListIcon: markRaw(RootListIcon)
};

// 响应式表单引用
const $Form = $ref({
    menuForm: null as any
});

// 响应式数据
const $Data = $ref({
    loading: false,
    menuList: [] as any[],
    dialogVisible: false,
    isEdit: false,
    formData: {
        id: 0,
        pid: 0,
        name: '',
        path: '',
        icon: '',
        type: 1,
        sort: 0,
        status: 1
    },
    columns: [
        { colKey: 'name', title: '菜单名称', width: 200 },
        { colKey: 'icon', title: '图标', width: 80 },
        { colKey: 'path', title: '路由路径', width: 150 },
        { colKey: 'type', title: '类型', width: 80 },
        { colKey: 'sort', title: '排序', width: 80 },
        { colKey: 'status', title: '状态', width: 80 },
        { colKey: 'operation', title: '操作', width: 150, fixed: 'right' }
    ],
    formRules: {
        name: [{ required: true, message: '请输入菜单名称', type: 'error' }],
        path: [{ required: true, message: '请输入路由路径', type: 'error' }],
        type: [{ required: true, message: '请选择菜单类型', type: 'error' }]
    },
    menuTreeOptions: [] as any[],
    iconOptions: [
        { label: '仪表盘', value: 'DashboardIcon' },
        { label: '用户', value: 'UserIcon' },
        { label: '设置', value: 'SettingIcon' },
        { label: '列表', value: 'ViewListIcon' },
        { label: '文件夹', value: 'FolderOpenIcon' },
        { label: '应用', value: 'AppIcon' },
        { label: '根列表', value: 'RootListIcon' }
    ]
});

// 方法集合
const $Method = {
    // 获取图标组件
    getIcon(iconName: string) {
        return iconMap[iconName] || null;
    },

    // 加载菜单列表
    async loadMenuList() {
        $Data.loading = true;
        try {
            const res = await $Http('/admin/menuList', {});
            if (res.code === 0 && res.data) {
                // 构建树形结构
                $Data.menuList = $Method.buildMenuTree(res.data);
                // 构建树形选择器数据（添加"无"选项）
                $Data.menuTreeOptions = [{ id: 0, name: '无（顶级菜单）', children: [] }, ...$Method.buildMenuTree(res.data)];
            }
        } catch (error) {
            MessagePlugin.error('加载菜单列表失败');
            console.error(error);
        } finally {
            $Data.loading = false;
        }
    },

    // 构建树形结构
    buildMenuTree(list: any[], pid = 0): any[] {
        const result: any[] = [];
        for (const item of list) {
            if (item.pid === pid) {
                const children = $Method.buildMenuTree(list, item.id);
                if (children.length > 0) {
                    item.children = children;
                }
                result.push(item);
            }
        }
        return result;
    },

    // 添加菜单
    handleAdd() {
        $Data.isEdit = false;
        $Data.formData = {
            id: 0,
            pid: 0,
            name: '',
            path: '',
            icon: '',
            type: 1,
            sort: 0,
            status: 1
        };
        $Data.dialogVisible = true;
    },

    // 编辑菜单
    handleEdit(row: any) {
        $Data.isEdit = true;
        $Data.formData = { ...row };
        $Data.dialogVisible = true;
    },

    // 提交表单
    async handleSubmit() {
        const valid = await $Form.menuForm.validate();
        if (!valid) return false;

        try {
            const apiUrl = $Data.isEdit ? '/admin/menuUpdate' : '/admin/menuCreate';
            const res = await $Http(apiUrl, $Data.formData);

            if (res.code === 0) {
                MessagePlugin.success($Data.isEdit ? '更新成功' : '创建成功');
                $Data.dialogVisible = false;
                await $Method.loadMenuList();
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

    // 删除菜单
    async handleDelete(id: number) {
        try {
            const res = await $Http('/admin/menuDelete', { id });
            if (res.code === 0) {
                MessagePlugin.success('删除成功');
                await $Method.loadMenuList();
            } else {
                MessagePlugin.error(res.msg || '删除失败');
            }
        } catch (error) {
            MessagePlugin.error('删除失败');
            console.error(error);
        }
    }
};

// 初始化加载
$Method.loadMenuList();
</script>

<style scoped lang="scss">
.menu-manage {
    padding: 20px;

    .text-placeholder {
        color: var(--td-text-color-placeholder);
    }
}
</style>
