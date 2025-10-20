<template>
    <tiny-dialog-box v-model:visible="$Visible" title="菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh">
        <tiny-tree :data="$Data.menuTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'name' }" :ref="(el) => ($Form.tree = el)" />
        <template #footer>
            <tiny-button @click="$Visible = false">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.onSubmit">保存</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
const $Visible = defineModel({ default: false });

const $Prop = defineProps({
    rowData: {
        type: Object,
        default: () => ({})
    }
});

const $Emit = defineEmits(['success']);

// 表单引用
const $Form = $shallowRef({
    tree: null
});

const $Data = $ref({
    menuTreeData: []
});

// 方法集合
const $Method = {
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

    // 加载该角色已分配的菜单
    async loadRoleMenus() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/roleMenuGet', { roleId: $Prop.rowData.id });
            if (res.code === 0) {
                // 设置选中的菜单节点
                const checkedKeys = Array.isArray(res.data) ? res.data : [];
                nextTick(() => {
                    $Form.tree?.setCheckedKeys(checkedKeys);
                });
            }
        } catch (error) {
            console.error('加载角色菜单失败:', error);
        }
    },

    // 提交表单
    async onSubmit() {
        try {
            if (!$Form.tree) {
                Modal.message({ message: '菜单树未初始化', status: 'error' });
                return;
            }

            // 获取选中的节点（包括半选中的父节点）
            const checkedKeys = $Form.tree.getCheckedKeys();
            const halfCheckedKeys = $Form.tree.getHalfCheckedKeys();
            const menuIds = [...checkedKeys, ...halfCheckedKeys];

            const res = await $Http('/addon/admin/roleMenuSave', {
                roleId: $Prop.rowData.id,
                menuIds
            });

            if (res.code === 0) {
                Modal.message({
                    message: '保存成功',
                    status: 'success'
                });
                $Visible.value = false;
                $Emit('success');
            } else {
                Modal.message({
                    message: res.msg || '保存失败',
                    status: 'error'
                });
            }
        } catch (error) {
            console.error('保存失败:', error);
            Modal.message({
                message: '保存失败',
                status: 'error'
            });
        }
    }
};
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
