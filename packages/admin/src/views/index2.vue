<template>
    <div class="dashboard">
        <h1>后台数据面板</h1>

        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">
                    <i class="icon-users"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-number">12,345</div>
                    <div class="stat-label">总用户数</div>
                    <div class="stat-change positive">+5.2% 本月</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon green">
                    <i class="icon-dollar"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-number">$45,678</div>
                    <div class="stat-label">总收入</div>
                    <div class="stat-change positive">+8.9% 本月</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon purple">
                    <i class="icon-shopping-cart"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-number">789</div>
                    <div class="stat-label">总订单数</div>
                    <div class="stat-change positive">+12.5% 本月</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon orange">
                    <i class="icon-eye"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-number">98,765</div>
                    <div class="stat-label">访问量</div>
                    <div class="stat-change negative">-2.1% 本月</div>
                </div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
            <div class="chart-card">
                <h3>月度收入趋势</h3>
                <div class="chart-container">
                    <div class="line-chart">
                        <div class="chart-line"></div>
                        <div class="chart-grid"></div>
                        <div class="chart-labels"><span>1月</span><span>2月</span><span>3月</span><span>4月</span><span>5月</span><span>6月</span><span>7月</span><span>8月</span><span>9月</span><span>10月</span><span>11月</span><span>12月</span></div>
                    </div>
                </div>
            </div>

            <div class="chart-card">
                <h3>订单类型分布</h3>
                <div class="chart-container">
                    <div class="bar-chart">
                        <div class="bar-group">
                            <div class="bar" style="height: 65%; background: #3498db">
                                <div class="bar-label">实物商品</div>
                                <div class="bar-value">65%</div>
                            </div>
                            <div class="bar" style="height: 25%; background: #e74c3c">
                                <div class="bar-label">虚拟商品</div>
                                <div class="bar-value">25%</div>
                            </div>
                            <div class="bar" style="height: 10%; background: #9b59b6">
                                <div class="bar-label">服务</div>
                                <div class="bar-value">10%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Orders -->
        <div class="orders-table-card">
            <h3>最新订单</h3>
            <div class="table-container">
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th>订单号</th>
                            <th>用户</th>
                            <th>金额</th>
                            <th>状态</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>ORDER-001</td>
                            <td>张三</td>
                            <td>$123.45</td>
                            <td><span class="status completed">已完成</span></td>
                            <td>2023-11-18 14:30</td>
                        </tr>
                        <tr>
                            <td>ORDER-002</td>
                            <td>李四</td>
                            <td>$67.89</td>
                            <td><span class="status pending">待处理</span></td>
                            <td>2023-11-18 14:25</td>
                        </tr>
                        <tr>
                            <td>ORDER-003</td>
                            <td>王五</td>
                            <td>$234.56</td>
                            <td><span class="status shipping">配送中</span></td>
                            <td>2023-11-18 14:20</td>
                        </tr>
                        <tr>
                            <td>ORDER-004</td>
                            <td>赵六</td>
                            <td>$89.01</td>
                            <td><span class="status cancelled">已取消</span></td>
                            <td>2023-11-18 14:15</td>
                        </tr>
                        <tr>
                            <td>ORDER-005</td>
                            <td>孙七</td>
                            <td>$56.78</td>
                            <td><span class="status completed">已完成</span></td>
                            <td>2023-11-18 14:10</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup>
definePage({
    meta: {
        title: "数据面板",
        layout: "default"
    }
});
</script>

<style lang="scss" scoped>
.dashboard {
    padding: 20px;
    min-height: 100vh;
    background-color: #f5f7fa;
    font-family: "Arial", sans-serif;
}

h1 {
    color: #2c3e50;
    font-size: 24px;
    margin-bottom: 20px;
    font-weight: 600;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

.stat-card {
    background-color: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    transition:
        transform 0.2s,
        box-shadow 0.2s;

    &:hover {
        transform: translateY(-5px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
}

.stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-right: 20px;
    color: #fff;

    &.blue {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.green {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    &.purple {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.orange {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
}

.stat-content {
    flex: 1;
}

.stat-number {
    font-size: 24px;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 14px;
    color: #90a4ae;
    margin-bottom: 4px;
}

.stat-change {
    font-size: 12px;
    font-weight: 600;

    &.positive {
        color: #4caf50;
    }

    &.negative {
        color: #f44336;
    }
}

.charts-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 20px;
    margin-bottom: 20px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
}

.chart-card {
    background-color: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chart-card h3 {
    color: #2c3e50;
    font-size: 18px;
    margin-bottom: 20px;
    font-weight: 600;
}

.chart-container {
    height: 250px;
    background-color: #fafafa;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.line-chart {
    width: 100%;
    height: 100%;
    position: relative;

    .chart-grid {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
        background-size: 40px 40px;
    }

    .chart-line {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(to right, #3498db, #9b59b6);
        animation: lineMove 3s ease-in-out infinite;
    }

    .chart-labels {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #90a4ae;
        padding: 0 10px;
    }
}

@keyframes lineMove {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-50px);
    }
}

.bar-chart {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 40px;
}

.bar-group {
    display: flex;
    align-items: flex-end;
    gap: 20px;
}

.bar {
    width: 80px;
    border-radius: 4px 4px 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 10px 0;
    position: relative;
    transition: transform 0.3s ease;

    &:hover {
        transform: scaleY(1.05);
    }

    .bar-label {
        font-size: 12px;
        color: #2c3e50;
        margin-bottom: 4px;
        font-weight: 600;
    }

    .bar-value {
        font-size: 14px;
        color: #fff;
        font-weight: 700;
        margin-bottom: 4px;
    }
}

.orders-table-card {
    background-color: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.orders-table-card h3 {
    color: #2c3e50;
    font-size: 18px;
    margin-bottom: 20px;
    font-weight: 600;
}

.table-container {
    overflow-x: auto;
}

.orders-table {
    width: 100%;
    border-collapse: collapse;
}

.orders-table th {
    background-color: #f5f7fa;
    color: #2c3e50;
    text-align: left;
    padding: 12px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 2px solid #e0e0e0;
}

.orders-table td {
    padding: 12px;
    font-size: 14px;
    color: #455a64;
    border-bottom: 1px solid #e0e0e0;
}

.orders-table tbody tr:hover {
    background-color: #fafafa;
}

.status {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;

    &.completed {
        background-color: #e8f5e9;
        color: #4caf50;
    }

    &.pending {
        background-color: #fff3e0;
        color: #ff9800;
    }

    &.shipping {
        background-color: #e3f2fd;
        color: #2196f3;
    }

    &.cancelled {
        background-color: #ffebee;
        color: #f44336;
    }
}
</style>
