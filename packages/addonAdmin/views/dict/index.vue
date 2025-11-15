<template>
    <div class="page-dict page-table">
        <div class="main-tool">
            <div class="left">
                <t-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <IconLucidePlus />
                    </template>
                    添加字典
                </t-button>
            </div>
            <div class="right">
                <t-button @click="$Method.handleRefresh">
                    <template #icon>
                        <IconLucideRotateCw />
                    </template>
                    刷新
                </t-button>
            </div>
        </div>
        <div class="main-table">
            <t-table :data="$Data.dictList" :columns="$Data.columns" header-cell-class-name="custom-table-cell-class" size="small" height="100%" row-key="id">
                <template #state="{ row }">
                    <t-tag v-if="row.state === 1" theme="success">正常</t-tag>
                    <t-tag v-else-if="row.state === 2" theme="warning">禁用</t-tag>
                    <t-tag v-else theme="danger">已删除</t-tag>
                </template>
                <template #operation="{ row }">
                    <t-dropdown trigger="click" min-column-width="120" @click="(data) => $Method.onAction(data.value, row)">
                        <t-button variant="text" size="small">操作</t-button>
                        <t-dropdown-menu slot="dropdown">
                            <t-dropdown-item value="upd">
                                <IconLucidePencil />
                                编辑
                            </t-dropdown-item>
                            <t-dropdown-item value="del" :divider="true">
                                <IconLucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                删除
                            </t-dropdown-item>
                        </t-dropdown-menu>
                    </t-dropdown>
                </template>
            </t-table>
        </div>

        <div class="main-page">
            <t-pagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiDictList" />
    </div>
</template>

<script setup>

import EditDialog from './components/edit.vue';
import { $Http } from '@/plugins/http';

// 响应式数据
const $Data = $ref({
    dictList: [],
    columns: [
        { colKey: 'index', title: '序号', width: 60, align: 'center' },
        { colKey: 'name', title: '字典名称' },
        { colKey: 'code', title: '字典代码', width: 150 },
        { colKey: 'value', title: '字典值', width: 200 },
        { colKey: 'pid', title: '父级ID', width: 100 },
        { colKey: 'sort', title: '排序', width: 80 },
        { colKey: 'description', title: '描述', ellipsis: true },
        { colKey: 'state', title: '状态', width: 100 },
        { colKey: 'operation', title: '操作', width: 120, align: 'right' }
    ],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiDictList();
    },

    // 加载字典列表
    async apiDictList() {
        try {
            const res = await $Http('/addon/admin/dict/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.dictList = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载字典列表失败:', error);
            MessagePlugin.info({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除字典
    async apiDictDel(row) {
        DialogPlugin.confirm({
            header: '确认删除',
            body: `确定要删除字典"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/dict/del', { id: row.id });
                if (res.code === 0) {
                    MessagePlugin.info({ message: '删除成功', status: 'success' });
                    $Method.apiDictList();
                } else {
                    MessagePlugin.info({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                MessagePlugin.info({ message: '删除失败', status: 'error' });
            }
        });
    },

    // 刷新
    handleRefresh() {
        $Method.apiDictList();
    },

    // 分页改变
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiDictList();
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'del') {
            $Method.apiDictDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
