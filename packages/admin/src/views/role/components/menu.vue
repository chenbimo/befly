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
import { arrayToTree } from '../../../util';

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
    menuTreeData: [],
    menuTreeCheckedKeys: []
});

// 监听弹窗显示，每次打开时重新加载数据
watch($Visible, (newVal) => {
    if (newVal) {
        $Method.initData();
    }
});

// 方法集合
const $Method = {
    async initData() {
        await Promise.all([$Method.apiMenuAll(), $Method.apiRoleDetail()]);
    },
    // 加载菜单树
    async apiMenuAll() {
        try {
            const res = await $Http('/addon/admin/menuAll');
            $Data.menuTreeData = arrayToTree(res.data.lists);
        } catch (error) {
            console.error('加载菜单失败:', error);
            Modal.message({ message: '加载菜单失败', status: 'error' });
        }
    },

    // 加载该角色已分配的菜单
    async apiRoleDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/roleDetail');
            $Data.menuTreeCheckedKeys = res.data.menuIds || [];
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
