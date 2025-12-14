<template>
    <TDialog v-model:visible="$Data.visible" title="菜单权限" width="600px" :append-to-body="true" :show-footer="true" top="10vh" @close="$Method.onClose">
        <div class="comp-role-menu">
            <TTree v-model:value="$Data.menuTreeCheckedKeys" :data="$Data.menuTreeData" value-mode="all" :keys="{ value: 'id', label: 'name', children: 'children' }" checkable expand-all />
        </div>
        <template #footer>
            <TButton @click="$Method.onClose">取消</TButton>
            <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">保存</TButton>
        </template>
    </TDialog>
</template>

<script setup>
import { Dialog as TDialog, Tree as TTree, Button as TButton, MessagePlugin } from 'tdesign-vue-next';
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

const $Data = $ref({
    visible: false,
    submitting: false,
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
            MessagePlugin.error('加载菜单失败');
        }
    },

    // 加载该角色已分配的菜单
    async apiRoleMenuDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/role/menus', {
                roleCode: $Prop.rowData.code
            });

            // menus 返回的 data 直接就是菜单 ID 数组
            $Data.menuTreeCheckedKeys = Array.isArray(res.data) ? res.data : [];
        } catch (error) {
            MessagePlugin.error('加载数据失败');
        }
    },

    // 提交表单
    async onSubmit() {
        try {
            $Data.submitting = true;

            const res = await $Http('/addon/admin/role/menuSave', {
                roleCode: $Prop.rowData.code,
                menuIds: $Data.menuTreeCheckedKeys
            });

            if (res.code === 0) {
                MessagePlugin.success('保存成功');
                $Data.visible = false;
                $Emit('success');
            } else {
                MessagePlugin.error(res.msg || '保存失败');
            }
        } catch (error) {
            MessagePlugin.error('保存失败');
        } finally {
            $Data.submitting = false;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-menu {
}
</style>
