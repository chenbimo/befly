<template>
    <tiny-dialog-box v-model:visible="$Data.visible" title="菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh" @close="$Method.onClose">
        <tiny-tree :data="$Data.menuTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'name' }" :ref="(el) => ($Form.tree = el)" />
        <template #footer>
            <tiny-button @click="$Method.onClose">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.onSubmit">保存</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
import { arrayToTree } from '../../../util';

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    rowData: {
        type: Object,
        default: () => ({})
    }
});

const $Emit = defineEmits(['update:modelValue', 'success']);

// 表单引用
const $Form = $shallowRef({
    tree: null
});

const $Data = $ref({
    visible: false,
    menuTreeData: [],
    menuTreeCheckedKeys: []
});

// 方法集合
const $Method = {
    async initData() {
        await Promise.all([$Method.apiMenuAll(), $Method.apiRoleDetail()]);
        $Method.onShow();
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
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
                $Data.visible = false;
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

$Method.initData();
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
