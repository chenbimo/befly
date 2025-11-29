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
                <TTable :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" row-key="id" :tree="{ childrenKey: 'children', treeNodeColumnIndex: 0, defaultExpandAll: true }" :selected-row-keys="$Data.selectedRowKeys" active-row-type="single" :active-row-keys="$Data.activeRowKeys" @select-change="$Method.onSelectChange" @active-change="$Method.onActiveChange">
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                        <TTag v-else-if="row.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                        <TTag v-else-if="row.state === 0" shape="round" theme="danger" variant="light-outline">删除</TTag>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel
                    :data="$Data.currentRow"
                    :fields="[
                        { key: 'id', label: 'ID' },
                        { key: 'name', label: '菜单名称' },
                        { key: 'path', label: '路由路径' },
                        { key: 'icon', label: '图标' },
                        { key: 'sort', label: '排序' },
                        { key: 'pid', label: '父级ID', default: '顶级菜单' },
                        { key: 'state', label: '状态' }
                    ]"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, MessagePlugin } from 'tdesign-vue-next';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import DetailPanel from '@/components/DetailPanel.vue';
import { $Http } from '@/plugins/http';
import { withDefaultColumns } from '@/utils';

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        {
            colKey: 'row-select',
            type: 'single',
            width: 50,
            fixed: 'left',
            checkProps: { allowUncheck: true },
            ellipsis: false
        },
        { colKey: 'name', title: '菜单名称', width: 200, fixed: 'left' },
        { colKey: 'id', title: '序号', width: 100, align: 'center' },
        { colKey: 'path', title: '路由路径', width: 250 },
        { colKey: 'icon', title: '图标', width: 120 },
        { colKey: 'sort', title: '排序', width: 80, align: 'center' },
        { colKey: 'state', title: '状态', width: 100, ellipsis: false }
    ]),
    currentRow: null,
    selectedRowKeys: [],
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
            const res = await $Http('/addon/admin/menu/list');
            // 构建树形结构
            $Data.tableData = $Method.buildTree(res.data || []);

            // 自动选中并高亮第一行
            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.selectedRowKeys = [$Data.tableData[0].id];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.selectedRowKeys = [];
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            console.error('加载菜单列表失败:', error);
            MessagePlugin.error('加载数据失败');
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

    // 单选变化
    onSelectChange(value, { selectedRowData }) {
        $Data.selectedRowKeys = value;
        $Data.activeRowKeys = value;
        if (selectedRowData && selectedRowData.length > 0) {
            $Data.currentRow = selectedRowData[0];
        } else if ($Data.tableData.length > 0) {
            $Data.currentRow = $Data.tableData[0];
            $Data.selectedRowKeys = [$Data.tableData[0].id];
            $Data.activeRowKeys = [$Data.tableData[0].id];
        } else {
            $Data.currentRow = null;
        }
    },

    // 高亮行变化
    onActiveChange(value, { activeRowData }) {
        $Data.activeRowKeys = value;
        $Data.selectedRowKeys = value;
        if (activeRowData && activeRowData.length > 0) {
            $Data.currentRow = activeRowData[0];
        } else if ($Data.tableData.length > 0) {
            $Data.currentRow = $Data.tableData[0];
            $Data.selectedRowKeys = [$Data.tableData[0].id];
            $Data.activeRowKeys = [$Data.tableData[0].id];
        } else {
            $Data.currentRow = null;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
