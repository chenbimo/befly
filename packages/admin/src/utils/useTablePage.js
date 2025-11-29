/**
 * 表格页面通用组合式函数
 * 封装分页、loading、数据加载等公共逻辑
 */
import { ref, reactive } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { $Http } from '@/plugins/http';

/**
 * 创建表格页面通用逻辑
 * @param {Object} options 配置项
 * @param {string} options.apiUrl - 列表接口地址
 * @param {Function} [options.afterLoad] - 数据加载后的回调
 * @param {Function} [options.transformData] - 数据转换函数
 * @returns {Object} 响应式数据和方法
 */
export function useTablePage(options) {
    const { apiUrl, afterLoad, transformData } = options;

    // 分页配置
    const pagerConfig = reactive({
        currentPage: 1,
        limit: 30,
        total: 0
    });

    // 加载状态
    const loading = ref(false);

    // 表格数据
    const tableData = ref([]);

    // 当前选中行
    const currentRow = ref(null);

    // 选中行的 keys
    const activeRowKeys = ref([]);
    const selectedRowKeys = ref([]);

    /**
     * 加载列表数据
     * @param {Object} [extraParams={}] - 额外的查询参数
     */
    async function loadData(extraParams = {}) {
        loading.value = true;
        try {
            const res = await $Http(apiUrl, {
                page: pagerConfig.currentPage,
                limit: pagerConfig.limit,
                ...extraParams
            });

            let data = res.data.lists || [];

            // 数据转换
            if (transformData) {
                data = transformData(data);
            }

            tableData.value = data;
            pagerConfig.total = res.data.total || 0;

            // 自动选中并高亮第一行
            if (tableData.value.length > 0) {
                currentRow.value = tableData.value[0];
                selectedRowKeys.value = [tableData.value[0].id];
                activeRowKeys.value = [tableData.value[0].id];
            } else {
                currentRow.value = null;
                selectedRowKeys.value = [];
                activeRowKeys.value = [];
            }

            // 执行加载后回调
            if (afterLoad) {
                afterLoad(tableData.value);
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            MessagePlugin.error('加载数据失败');
        } finally {
            loading.value = false;
        }
    }

    /**
     * 刷新数据
     */
    function handleRefresh() {
        loadData();
    }

    /**
     * 分页改变
     * @param {Object} param
     * @param {number} param.currentPage - 当前页码
     */
    function onPageChange({ currentPage }) {
        pagerConfig.currentPage = currentPage;
        loadData();
    }

    /**
     * 每页条数改变
     * @param {Object} param
     * @param {number} param.pageSize - 每页条数
     */
    function handleSizeChange({ pageSize }) {
        pagerConfig.limit = pageSize;
        pagerConfig.currentPage = 1;
        loadData();
    }

    /**
     * 高亮行变化（点击行选中）
     * @param {Array} value - 选中的行 keys
     * @param {Object} param
     * @param {Array} param.activeRowData - 选中的行数据
     */
    function onActiveChange(value, { activeRowData }) {
        activeRowKeys.value = value;
        selectedRowKeys.value = value;
        // 更新当前高亮的行数据
        if (activeRowData && activeRowData.length > 0) {
            currentRow.value = activeRowData[0];
        } else if (tableData.value.length > 0) {
            // 如果取消高亮，默认显示第一行
            currentRow.value = tableData.value[0];
            selectedRowKeys.value = [tableData.value[0].id];
            activeRowKeys.value = [tableData.value[0].id];
        } else {
            currentRow.value = null;
        }
    }

    /**
     * 单选变化
     * @param {Array} value - 选中的行 keys
     * @param {Object} param
     * @param {Array} param.selectedRowData - 选中的行数据
     */
    function onSelectChange(value, { selectedRowData }) {
        selectedRowKeys.value = value;
        activeRowKeys.value = value;
        // 更新当前选中的行数据
        if (selectedRowData && selectedRowData.length > 0) {
            currentRow.value = selectedRowData[0];
        } else if (tableData.value.length > 0) {
            // 如果取消选中，默认显示第一行
            currentRow.value = tableData.value[0];
            selectedRowKeys.value = [tableData.value[0].id];
            activeRowKeys.value = [tableData.value[0].id];
        } else {
            currentRow.value = null;
        }
    }

    return {
        // 数据
        pagerConfig: pagerConfig,
        loading: loading,
        tableData: tableData,
        currentRow: currentRow,
        activeRowKeys: activeRowKeys,
        selectedRowKeys: selectedRowKeys,
        // 方法
        loadData: loadData,
        handleRefresh: handleRefresh,
        onPageChange: onPageChange,
        handleSizeChange: handleSizeChange,
        onActiveChange: onActiveChange,
        onSelectChange: onSelectChange
    };
}
