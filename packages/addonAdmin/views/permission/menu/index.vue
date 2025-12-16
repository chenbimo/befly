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
                <TTable v-bind="withTreeTableProps()" :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" row-key="id" height="calc(100vh - var(--search-height) - var(--layout-gap) * 2)" active-row-type="single" @active-change="$Method.onActiveChange">
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
import { withDefaultColumns } from "befly-vite/utils/withDefaultColumns";
import { withTreeTableProps } from "@/utils";

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: "name", title: "菜单名称", fixed: "left" },
        { colKey: "id", title: "序号" },
        { colKey: "path", title: "路由路径" },
        { colKey: "icon", title: "图标" },
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
            const res = await $Http("/addon/admin/menu/list");
            // 构建树形结构
            $Data.tableData = $Method.buildTree(res.data || []);

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

    // 构建树形结构
    buildTree(list) {
        const map = {};
        const roots = [];

        // 先创建所有节点的映射
        for (const item of list) {
            map[item.id] = { ...item, children: [] };
        }

        // 构建树形结构
        for (const item of list) {
            const node = map[item.id];
            if (item.pid === 0) {
                roots.push(node);
            } else if (map[item.pid]) {
                map[item.pid].children.push(node);
            } else {
                roots.push(node);
            }
        }

        // 移除空的 children 数组
        const removeEmptyChildren = (nodes) => {
            for (const node of nodes) {
                if (node.children.length === 0) {
                    delete node.children;
                } else {
                    removeEmptyChildren(node.children);
                }
            }
        };
        removeEmptyChildren(roots);

        return roots;
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
