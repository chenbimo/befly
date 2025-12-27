<template>
    <TDialog v-model:visible="$Data.visible" title="菜单权限" width="900px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-menu">
            <!-- 搜索框 -->
            <div class="search-box">
                <TInput v-model="$Data.searchText" placeholder="搜索菜单名称或路径" clearable @change="$Method.onSearch">
                    <template #prefix-icon>
                        <ILucideSearch />
                    </template>
                </TInput>
            </div>

            <div class="menu-container">
                <TTree v-model:value="$Data.menuTreeCheckedKeys" :data="$Data.menuTreeData" value-mode="all" :keys="{ value: 'path', label: 'name', children: 'children' }" checkable expand-all />
            </div>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <t-space>
                    <TButton theme="default" @click="$Method.onClose">取消</TButton>
                    <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">保存</TButton>
                </t-space>
            </div>
        </template>
    </TDialog>
</template>

<script setup>
import { Dialog as TDialog, Tree as TTree, Button as TButton, Input as TInput, MessagePlugin } from "tdesign-vue-next";
import ILucideSearch from "~icons/lucide/search";
import { $Http } from "@/plugins/http";
import { arrayToTree } from "befly-shared/utils/arrayToTree";

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

const $Emit = defineEmits(["update:modelValue", "success"]);

const $Data = $ref({
    visible: false,
    submitting: false,
    searchText: "",
    menuTreeDataAll: [],
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
            $Emit("update:modelValue", false);
        }, 300);
    },

    // 加载菜单树（用于配置权限）
    async apiMenuAll() {
        try {
            const res = await $Http("/addon/admin/menu/all");
            const lists = Array.isArray(res?.data?.lists) ? res.data.lists : [];

            const treeResult = arrayToTree(lists, "path", "parentPath", "children", "sort");
            $Data.menuTreeDataAll = treeResult.tree;
            $Data.menuTreeData = treeResult.tree;
        } catch (error) {
            MessagePlugin.error("加载菜单失败");
        }
    },

    // 加载该角色已分配的菜单
    async apiRoleMenuDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http("/addon/admin/role/menus", {
                roleCode: $Prop.rowData.code
            });

            // menus 返回的 data 直接就是菜单 path 数组
            $Data.menuTreeCheckedKeys = Array.isArray(res.data) ? res.data : [];
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        }
    },

    // 搜索过滤（保留命中的节点及其祖先节点）
    onSearch() {
        const kw = typeof $Data.searchText === "string" ? $Data.searchText.trim().toLowerCase() : "";
        if (!kw) {
            $Data.menuTreeData = $Data.menuTreeDataAll;
            return;
        }

        const filterTree = (nodes) => {
            if (!Array.isArray(nodes)) return [];

            const out = [];
            for (const node of nodes) {
                const name = typeof node?.name === "string" ? node.name : "";
                const path = typeof node?.path === "string" ? node.path : "";

                const hit = `${name} ${path}`.toLowerCase().includes(kw);
                const children = filterTree(node?.children);

                if (hit || children.length > 0) {
                    out.push({
                        ...node,
                        children
                    });
                }
            }

            return out;
        };

        $Data.menuTreeData = filterTree($Data.menuTreeDataAll);
    },

    // 提交表单
    async onSubmit() {
        try {
            $Data.submitting = true;

            const res = await $Http("/addon/admin/role/menuSave", {
                roleCode: $Prop.rowData.code,
                menuPaths: $Data.menuTreeCheckedKeys
            });

            if (res.code === 0) {
                MessagePlugin.success("保存成功");
                $Data.visible = false;
                $Emit("success");
            } else {
                MessagePlugin.error(res.msg || "保存失败");
            }
        } catch (error) {
            MessagePlugin.error("保存失败");
        } finally {
            $Data.submitting = false;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-menu {
    height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .menu-container {
        flex: 1;
        overflow: auto;

        :deep(.t-tree) {
            width: 100%;
        }
    }
}

.dialog-footer {
    width: 100%;
    display: flex;
    justify-content: center;
}
</style>
