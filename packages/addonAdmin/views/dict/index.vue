<template>
    <div class="page-dict page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
                </TButton>
            </div>
            <div class="right">
                <TButton @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>
        <div class="main-content">
            <div class="main-table">
                <TTable :data="$Data.dictList" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" @active-change="$Method.onActiveChange">
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" theme="success">正常</TTag>
                        <TTag v-else-if="row.state === 2" theme="warning">禁用</TTag>
                        <TTag v-else theme="danger">已删除</TTag>
                    </template>
                    <template #operation="{ row }">
                        <TDropdown trigger="click" min-column-width="120" @click="(data) => $Method.onAction(data.value, row)">
                            <TButton variant="text" size="small">操作</TButton>
                            <TDropdownMenu slot="dropdown">
                                <TDropdownItem value="upd">
                                    <ILucidePencil />
                                    编辑
                                </TDropdownItem>
                                <TDropdownItem value="del" :divider="true">
                                    <ILucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                    删除
                                </TDropdownItem>
                            </TDropdownMenu>
                        </TDropdown>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.columns" />
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiDictList" />
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import ILucidePlus from '~icons/lucide/plus';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import ILucidePencil from '~icons/lucide/pencil';
import ILucideTrash2 from '~icons/lucide/trash-2';
import EditDialog from './components/edit.vue';
import DetailPanel from '@/components/DetailPanel.vue';
import { $Http } from '@/plugins/http';
import { withDefaultColumns } from '@/utils';

// 响应式数据
const $Data = $ref({
    dictList: [],
    loading: false,
    activeRowKeys: [],
    currentRow: null,
    columns: withDefaultColumns([
        { colKey: 'index', title: '序号' },
        { colKey: 'name', title: '字典名称' },
        { colKey: 'code', title: '字典代码' },
        { colKey: 'value', title: '字典值' },
        { colKey: 'pid', title: '父级ID', width: 100 },
        { colKey: 'sort', title: '排序' },
        { colKey: 'description', title: '描述' },
        { colKey: 'state', title: '状态' },
        { colKey: 'operation', title: '操作', width: 120 }
    ]),
    pagerConfig: {
        currentPage: 1,
        limit: 30,
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
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/dict/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.dictList = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

            // 自动选中并高亮第一行
            if ($Data.dictList.length > 0) {
                $Data.currentRow = $Data.dictList[0];
                $Data.activeRowKeys = [$Data.dictList[0].id];
            } else {
                $Data.currentRow = null;
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            console.error('加载字典列表失败:', error);
            MessagePlugin.error('加载数据失败');
        } finally {
            $Data.loading = false;
        }
    },

    // 删除字典
    async apiDictDel(row) {
        DialogPlugin.confirm({
            header: '确认删除',
            body: `确定要删除字典“${row.name}” 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/dict/del', { id: row.id });
                if (res.code === 0) {
                    MessagePlugin.success('删除成功');
                    $Method.apiDictList();
                } else {
                    MessagePlugin.error(res.msg || '删除失败');
                }
            } catch (error) {
                console.error('删除失败:', error);
                MessagePlugin.error('删除失败');
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

    // 每页条数改变
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictList();
    },

    // 高亮行变化（点击行选中）
    onActiveChange(value, { activeRowData }) {
        $Data.activeRowKeys = value;
        // 更新当前高亮的行数据
        if (activeRowData && activeRowData.length > 0) {
            $Data.currentRow = activeRowData[0];
        } else if ($Data.dictList.length > 0) {
            // 如果取消高亮，默认显示第一行
            $Data.currentRow = $Data.dictList[0];
            $Data.activeRowKeys = [$Data.dictList[0].id];
        } else {
            $Data.currentRow = null;
        }
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
