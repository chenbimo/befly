<template>
    <div class="page-menu page-table">
        <div class="main-tool">
            <div class="left"></div>
            <div class="right">
                <TButton shape="circle" @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>

        <div class="main-content">
            <div class="main-table">
                <TTable
                    :data="$Data.tableData"
                    :columns="$Data.columns"
                    :loading="$Data.loading"
                    :active-row-keys="$Data.activeRowKeys"
                    row-key="id"
                    height="calc(100vh - var(--search-height) - var(--layout-gap) * 2)"
                    active-row-type="single"
                    :tree="{ childrenKey: 'children', treeNodeColumnIndex: 0, defaultExpandAll: true }"
                    @active-change="$Method.onActiveChange"
                >
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                        <TTag v-else-if="row.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                        <TTag v-else-if="row.state === 0" shape="round" theme="danger" variant="light-outline">删除</TTag>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.columns" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, MessagePlugin } from "tdesign-vue-next";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { arrayToTree } from "befly-shared/utils/arrayToTree";
import { withDefaultColumns } from "befly-vite/utils/withDefaultColumns";

definePage({
    meta: {
        title: "菜单列表",
        order: 2
    }
});

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: "name", title: "菜单名称" },
        { colKey: "path", title: "路由路径" },
        { colKey: "parentPath", title: "父级路径" },
        { colKey: "sort", title: "排序" },
        { colKey: "state", title: "状态" }
    ]),
    currentRow: null,
    activeRowKeys: []
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiMenuList();
    },

    // 加载菜单列表（树形结构）
    async apiMenuList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/menu/all");
            const lists = Array.isArray(res?.data?.lists) ? res.data.lists : [];

            const treeResult = arrayToTree(lists, "path", "parentPath", "children", "sort");

            // 构建树形结构（TTable tree）
            $Data.tableData = treeResult.tree;

            // 自动高亮第一行
            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        } finally {
            $Data.loading = false;
        }
    },

    // 刷新
    handleRefresh() {
        $Method.apiMenuList();
    },

    // 高亮行变化
    onActiveChange(value, context) {
        // 禁止取消高亮：如果新值为空，保持当前选中
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        // 更新当前高亮的行数据
        if (context.activeRowList && context.activeRowList.length > 0) {
            $Data.currentRow = context.activeRowList[0].row;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
