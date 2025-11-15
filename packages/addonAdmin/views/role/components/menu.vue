<template>
    <TinyDialogBox v-model:visible="$Data.visible" title="菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh" @close="$Method.onClose">
        <div class="comp-role-menu">
            <TinyTree :data="$Data.menuTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'name' }" :ref="(el) => ($From.tree = el)" />
        </div>
        <template #footer>
            <TinyButton @click="$Method.onClose">取消</TinyButton>
            <TinyButton type="primary" @click="$Method.onSubmit">保存</TinyButton>
        </template>
    </TinyDialogBox>
</template>

<script setup>
import { nextTick } from 'vue';
import TinyButton from '@opentiny/vue-button';
import TinyDialogBox from '@opentiny/vue-dialog-box';
import TinyTree from '@opentiny/vue-tree';
import Modal from '@opentiny/vue-modal';

import { arrayToTree } from '@/utils';
import { $Http } from '@/plugins/http';

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
const $From = $shallowRef({
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
        await Promise.all([$Method.apiMenuAll(), $Method.apiRoleMenuDetail()]);
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

    // 加载菜单树（用于配置权限）
    async apiMenuAll() {
        try {
            const res = await $Http('/addon/admin/menu/all');
            // menuAll 返回的 data 直接就是菜单数组
            const menuList = Array.isArray(res.data) ? res.data : [];
            $Data.menuTreeData = arrayToTree(menuList);
        } catch (error) {
            console.error('加载菜单失败:', error);
            Modal.message({ message: '加载菜单失败', status: 'error' });
        }
    },

    // 加载该角色已分配的菜单
    async apiRoleMenuDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/role/menuDetail', {
                roleId: $Prop.rowData.id
            });

            // roleMenuDetail 返回的 data 直接就是菜单 ID 数组
            $Data.menuTreeCheckedKeys = Array.isArray(res.data) ? res.data : [];

            // 等待树渲染完成后设置选中状态
            nextTick(() => {
                if ($From.tree && $Data.menuTreeCheckedKeys.length > 0) {
                    $From.tree.setCheckedKeys($Data.menuTreeCheckedKeys);
                }
            });
        } catch (error) {
            console.error('加载角色菜单失败:', error);
        }
    },

    // 提交表单
    async onSubmit() {
        try {
            if (!$From.tree) {
                Modal.message({ message: '菜单树未初始化', status: 'error' });
                return;
            }

            // 获取选中的节点（包括半选中的父节点）
            const checkedKeys = $From.tree.getCheckedKeys();
            const halfCheckedKeys = $From.tree.getHalfCheckedKeys();
            const menuIds = [...checkedKeys, ...halfCheckedKeys];

            const res = await $Http('/addon/admin/role/menuSave', {
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
.comp-role-menu {
}
</style>
