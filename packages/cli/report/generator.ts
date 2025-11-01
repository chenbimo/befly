/**
 * 同步报告 HTML 生成器
 * 根据 SyncReport 数据生成美观的 HTML 报告
 */

import type { SyncReport } from '../types.js';

/**
 * 生成完整的 HTML 报告
 */
export function generateReportHTML(report: SyncReport): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Befly 同步报告 - ${report.meta.timestampStr}</title>
    <style>${getEmbeddedCSS()}</style>
</head>
<body>
    <div class="container">
        ${generateHeader(report)}
        ${generateSummary(report)}
        ${generateDatabaseSection(report)}
        ${generateApiSection(report)}
        ${generateMenuSection(report)}
        ${generateDevSection(report)}
    </div>
    <script>
        const reportData = ${JSON.stringify(report, null, 2)};
        ${getEmbeddedJS()}
    </script>
</body>
</html>`;
}

/**
 * 生成报告头部
 */
function generateHeader(report: SyncReport): string {
    const statusClass = report.meta.status === 'success' ? 'status-success' : 'status-error';
    const statusText = report.meta.status === 'success' ? '✅ 成功' : '❌ 失败';

    return `
<header class="header">
    <h1>🎯 Befly 同步报告</h1>
    <div class="meta-info">
        <div class="meta-item">
            <span class="meta-label">时间:</span>
            <span class="meta-value">${new Date(report.meta.timestamp).toLocaleString('zh-CN')}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">环境:</span>
            <span class="meta-value">${report.meta.environment}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">耗时:</span>
            <span class="meta-value">${report.meta.totalTime}ms</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">状态:</span>
            <span class="meta-value ${statusClass}">${statusText}</span>
        </div>
    </div>
    ${report.meta.error ? `<div class="error-message">错误: ${report.meta.error}</div>` : ''}
</header>`;
}

/**
 * 生成概览区
 */
function generateSummary(report: SyncReport): string {
    return `
<section class="summary">
    <h2>📊 概览</h2>
    <div class="summary-grid">
        <div class="summary-card">
            <div class="card-icon">📦</div>
            <div class="card-content">
                <div class="card-title">数据库</div>
                <div class="card-stats">
                    <span class="stat-item">处理: ${report.database.stats.processedTables}表</span>
                    <span class="stat-item">创建: ${report.database.stats.createdTables}</span>
                    <span class="stat-item">修改: ${report.database.stats.modifiedTables}</span>
                </div>
                <div class="card-time">${report.database.timing.processing}ms</div>
            </div>
        </div>

        <div class="summary-card">
            <div class="card-icon">🔌</div>
            <div class="card-content">
                <div class="card-title">接口</div>
                <div class="card-stats">
                    <span class="stat-item">总计: ${report.api.stats.totalApis}</span>
                    <span class="stat-item created">+${report.api.stats.created}</span>
                    <span class="stat-item updated">~${report.api.stats.updated}</span>
                    <span class="stat-item deleted">-${report.api.stats.deleted}</span>
                </div>
                <div class="card-time">${report.api.timing.scanning + report.api.timing.processing}ms</div>
            </div>
        </div>

        <div class="summary-card">
            <div class="card-icon">📋</div>
            <div class="card-content">
                <div class="card-title">菜单</div>
                <div class="card-stats">
                    <span class="stat-item">总计: ${report.menu.stats.totalMenus}</span>
                    <span class="stat-item created">+${report.menu.stats.created}</span>
                    <span class="stat-item updated">~${report.menu.stats.updated}</span>
                    <span class="stat-item deleted">-${report.menu.stats.deleted}</span>
                </div>
                <div class="card-time">${report.menu.timing.processing}ms</div>
            </div>
        </div>

        <div class="summary-card">
            <div class="card-icon">👤</div>
            <div class="card-content">
                <div class="card-title">开发账号</div>
                <div class="card-stats">
                    <span class="stat-item">管理员: ${report.dev.stats.adminCount}</span>
                    <span class="stat-item">角色: ${report.dev.stats.roleCount}</span>
                </div>
                <div class="card-time">${report.dev.timing.processing}ms</div>
            </div>
        </div>
    </div>
</section>`;
}

/**
 * 生成数据库详情区
 */
function generateDatabaseSection(report: SyncReport): string {
    const stats = report.database.stats;
    const tables = report.database.details.tables;

    // 检查是否有任何变更（基于 stats）
    const hasChanges = stats.createdTables > 0 || stats.modifiedTables > 0 || stats.addFields > 0 || stats.nameChanges > 0 || stats.typeChanges > 0 || stats.indexCreate > 0 || stats.indexDrop > 0;

    // 检查是否有处理记录
    const hasProcessed = stats.processedTables > 0;

    // 如果没有处理任何表
    if (!hasProcessed) {
        return `
<section class="section">
    <h2>📦 数据库同步</h2>
    <p class="empty-message">未处理任何表</p>
</section>`;
    }

    // 如果处理了表但没有变更，显示统计信息
    if (hasProcessed && !hasChanges && tables.length === 0) {
        return `
<section class="section">
    <h2>📦 数据库同步</h2>
    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">处理表数:</span>
            <span class="stat-value">${stats.processedTables}</span>
        </div>
    </div>
    <p class="info-message">已处理 ${stats.processedTables} 个表，数据库表结构已是最新状态，无需变更</p>
</section>`;
    }

    // 如果有变更但没有详细列表，显示统计信息
    if (hasChanges && tables.length === 0) {
        return `
<section class="section">
    <h2>📦 数据库同步</h2>
    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">处理表数:</span>
            <span class="stat-value">${stats.processedTables}</span>
        </div>
        ${stats.createdTables > 0 ? `<div class="stat-item"><span class="stat-label">新建表:</span><span class="stat-value created">${stats.createdTables}</span></div>` : ''}
        ${stats.modifiedTables > 0 ? `<div class="stat-item"><span class="stat-label">修改表:</span><span class="stat-value updated">${stats.modifiedTables}</span></div>` : ''}
        ${stats.addFields > 0 ? `<div class="stat-item"><span class="stat-label">新增字段:</span><span class="stat-value created">${stats.addFields}</span></div>` : ''}
        ${stats.nameChanges > 0 ? `<div class="stat-item"><span class="stat-label">字段名变更:</span><span class="stat-value updated">${stats.nameChanges}</span></div>` : ''}
        ${stats.typeChanges > 0 ? `<div class="stat-item"><span class="stat-label">字段类型变更:</span><span class="stat-value updated">${stats.typeChanges}</span></div>` : ''}
        ${stats.indexCreate > 0 ? `<div class="stat-item"><span class="stat-label">新增索引:</span><span class="stat-value created">${stats.indexCreate}</span></div>` : ''}
        ${stats.indexDrop > 0 ? `<div class="stat-item"><span class="stat-label">删除索引:</span><span class="stat-value deleted">${stats.indexDrop}</span></div>` : ''}
    </div>
    <p class="info-message">本次同步已处理 ${stats.processedTables} 个表，执行了变更操作</p>
</section>`;
    }

    const tablesHTML = tables
        .map((table) => {
            const actionBadge = table.action === 'create' ? '<span class="badge badge-created">新建</span>' : table.action === 'modify' ? '<span class="badge badge-updated">修改</span>' : '';

            const fieldsHTML =
                table.fields.added.length > 0 || table.fields.modified.length > 0
                    ? `
                <div class="detail-group">
                    <h4>字段变更</h4>
                    ${
                        table.fields.added.length > 0
                            ? `
                    <div class="change-list">
                        <strong>新增字段 (${table.fields.added.length}):</strong>
                        <ul>
                            ${table.fields.added.map((f) => `<li class="created">${f.name}: ${f.type}${f.length ? `(${f.length})` : ''} ${f.comment ? `- ${f.comment}` : ''}</li>`).join('')}
                        </ul>
                    </div>
                    `
                            : ''
                    }
                    ${
                        table.fields.modified.length > 0
                            ? `
                    <div class="change-list">
                        <strong>修改字段 (${table.fields.modified.length}):</strong>
                        <ul>
                            ${table.fields.modified
                                .map(
                                    (f) => `
                                <li class="updated">
                                    ${f.name}: ${f.before.type}${f.before.length ? `(${f.before.length})` : ''} → ${f.after.type}${f.after.length ? `(${f.after.length})` : ''}
                                    <span class="change-type">[${f.changeType}]</span>
                                </li>
                            `
                                )
                                .join('')}
                        </ul>
                    </div>
                    `
                            : ''
                    }
                </div>
            `
                    : '';

            const indexesHTML =
                table.indexes.added.length > 0 || table.indexes.removed.length > 0
                    ? `
                <div class="detail-group">
                    <h4>索引变更</h4>
                    ${
                        table.indexes.added.length > 0
                            ? `
                    <div class="change-list">
                        <strong>新增索引:</strong>
                        <ul>
                            ${table.indexes.added.map((idx) => `<li class="created">${idx.name} (${idx.fields.join(', ')})</li>`).join('')}
                        </ul>
                    </div>
                    `
                            : ''
                    }
                    ${
                        table.indexes.removed.length > 0
                            ? `
                    <div class="change-list">
                        <strong>删除索引:</strong>
                        <ul>
                            ${table.indexes.removed.map((idx) => `<li class="deleted">${idx.name} (${idx.fields.join(', ')})</li>`).join('')}
                        </ul>
                    </div>
                    `
                            : ''
                    }
                </div>
            `
                    : '';

            return `
            <details class="detail-item">
                <summary>
                    <span class="table-name">${table.name}</span>
                    ${actionBadge}
                    <span class="table-source">[${table.source === 'addon' ? `addon: ${table.addonName}` : '项目'}]</span>
                </summary>
                <div class="detail-content">
                    ${fieldsHTML}
                    ${indexesHTML}
                    ${
                        table.sql.length > 0
                            ? `
                    <div class="detail-group">
                        <h4>执行的 SQL</h4>
                        <pre class="sql-code">${table.sql.join(';\n\n')}</pre>
                    </div>
                    `
                            : ''
                    }
                </div>
            </details>
            `;
        })
        .join('');

    return `
<section class="section">
    <h2>📦 数据库同步详情</h2>
    <div class="details-container">
        ${tablesHTML}
    </div>
</section>`;
}

/**
 * 生成接口详情区
 */
function generateApiSection(report: SyncReport): string {
    const { created, updated, deleted } = report.api.details.byAction;

    const createdHTML =
        created.length > 0
            ? `
        <div class="detail-group">
            <h3>新增接口 (${created.length})</h3>
            <div class="api-list">
                ${created
                    .map(
                        (api) => `
                    <div class="api-item created">
                        <span class="api-method">${api.method}</span>
                        <span class="api-path">${api.path}</span>
                        <span class="api-name">${api.name}</span>
                        <span class="api-addon">[${api.addonName || '项目'}]</span>
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
    `
            : '';

    const updatedHTML =
        updated.length > 0
            ? `
        <div class="detail-group">
            <h3>更新接口 (${updated.length})</h3>
            <div class="api-list">
                ${updated
                    .map(
                        (api) => `
                    <div class="api-item updated">
                        <div class="api-header">
                            <span class="api-method">${api.method}</span>
                            <span class="api-path">${api.path}</span>
                            <span class="api-name">${api.name}</span>
                        </div>
                        <div class="api-changes">
                            ${api.changes.map((ch) => `<div class="change-item">${ch.field}: <span class="old-value">${ch.before}</span> → <span class="new-value">${ch.after}</span></div>`).join('')}
                        </div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
    `
            : '';

    const deletedHTML =
        deleted.length > 0
            ? `
        <div class="detail-group">
            <h3>删除接口 (${deleted.length})</h3>
            <div class="api-list">
                ${deleted
                    .map(
                        (api) => `
                    <div class="api-item deleted">
                        <span class="api-method">${api.method}</span>
                        <span class="api-path">${api.path}</span>
                        <span class="api-name">${api.name}</span>
                    </div>
                `
                    )
                    .join('')}
            </div>
        </div>
    `
            : '';

    return `
<section class="section">
    <h2>🔌 接口同步详情</h2>
    ${createdHTML}
    ${updatedHTML}
    ${deletedHTML}
    ${created.length === 0 && updated.length === 0 && deleted.length === 0 ? '<p class="empty-message">无接口变更</p>' : ''}
</section>`;
}

/**
 * 生成菜单详情区
 */
function generateMenuSection(report: SyncReport): string {
    const { created, updated, deleted } = report.menu.details.byAction;
    const stats = report.menu.stats;

    // 如果有统计数据但没有详细列表，显示统计信息
    const hasChanges = stats.created > 0 || stats.updated > 0 || stats.deleted > 0;

    if (!hasChanges) {
        return `
<section class="section">
    <h2>📋 菜单同步详情</h2>
    <p class="empty-message">无菜单变更</p>
</section>`;
    }

    return `
<section class="section">
    <h2>📋 菜单同步详情</h2>
    ${
        stats.created > 0
            ? `
    <div class="detail-group">
        <h3>新增菜单 (${stats.created})</h3>
        ${
            created.length > 0
                ? `
        <ul class="menu-list">
            ${created.map((m) => `<li class="created">${m.name} (${m.path})</li>`).join('')}
        </ul>
        `
                : '<p class="info-message">已新增菜单，但未收集详细列表</p>'
        }
    </div>
    `
            : ''
    }
    ${
        stats.updated > 0
            ? `
    <div class="detail-group">
        <h3>更新菜单 (${stats.updated})</h3>
        ${
            updated.length > 0
                ? `
        <ul class="menu-list">
            ${updated.map((m) => `<li class="updated">${m.name} (${m.path}) - ${m.changes.length} 项变更</li>`).join('')}
        </ul>
        `
                : '<p class="info-message">已更新 ' + stats.updated + ' 个菜单，但字段未实际变更（重新同步）</p>'
        }
    </div>
    `
            : ''
    }
    ${
        stats.deleted > 0
            ? `
    <div class="detail-group">
        <h3>删除菜单 (${stats.deleted})</h3>
        ${
            deleted.length > 0
                ? `
        <ul class="menu-list">
            ${deleted.map((m) => `<li class="deleted">${m.name} (${m.path})</li>`).join('')}
        </ul>
        `
                : '<p class="info-message">已删除菜单，但未收集详细列表</p>'
        }
    </div>
    `
            : ''
    }
</section>`;
}

/**
 * 生成开发账号详情区
 */
function generateDevSection(report: SyncReport): string {
    const { admins, roles } = report.dev.details;

    return `
<section class="section">
    <h2>👤 开发账号详情</h2>
    <div class="detail-group">
        <h3>管理员 (${admins.length})</h3>
        <ul class="dev-list">
            ${admins.map((a) => `<li class="${a.action}">${a.username} [${a.action}]</li>`).join('')}
        </ul>
    </div>
    <div class="detail-group">
        <h3>角色 (${roles.length})</h3>
        <ul class="dev-list">
            ${roles.map((r) => `<li class="${r.action}">${r.name} (${r.permissions}权限) [${r.action}]</li>`).join('')}
        </ul>
    </div>
</section>`;
}

/**
 * 获取内嵌的 CSS 样式
 */
function getEmbeddedCSS(): string {
    return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #333;
    line-height: 1.6;
    padding: 20px;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px;
    text-align: center;
}

.header h1 {
    font-size: 2.5em;
    margin-bottom: 20px;
}

.meta-info {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
}

.meta-item {
    display: flex;
    gap: 8px;
}

.meta-label {
    opacity: 0.9;
}

.meta-value {
    font-weight: bold;
}

.status-success {
    color: #10b981;
}

.status-error {
    color: #ef4444;
}

.error-message {
    background: rgba(239, 68, 68, 0.2);
    border-left: 4px solid #ef4444;
    padding: 12px;
    margin-top: 20px;
    border-radius: 4px;
}

.info-message {
    background: rgba(59, 130, 246, 0.1);
    border-left: 4px solid #3b82f6;
    padding: 12px;
    margin: 12px 0;
    border-radius: 4px;
    color: #1e40af;
    font-size: 0.9em;
}

.stats-summary {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    margin: 16px 0;
}

.stats-summary .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
}

.stats-summary .stat-item:last-child {
    border-bottom: none;
}

.stat-label {
    color: #6b7280;
    font-size: 0.95em;
}

.stat-value {
    font-weight: bold;
    color: #1f2937;
    font-size: 1.05em;
}

.stat-value.created {
    color: #10b981;
}

.stat-value.updated {
    color: #f59e0b;
}

.stat-value.deleted {
    color: #ef4444;
}

.summary {
    padding: 40px;
    background: #f9fafb;
}

.summary h2 {
    font-size: 1.8em;
    margin-bottom: 24px;
    color: #1f2937;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.summary-card {
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    display: flex;
    gap: 16px;
    transition: transform 0.2s;
}

.summary-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 12px rgba(0,0,0,0.15);
}

.card-icon {
    font-size: 2.5em;
}

.card-content {
    flex: 1;
}

.card-title {
    font-size: 1.1em;
    font-weight: bold;
    color: #374151;
    margin-bottom: 8px;
}

.card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
}

.stat-item {
    font-size: 0.9em;
    color: #6b7280;
}

.stat-item.created {
    color: #10b981;
    font-weight: bold;
}

.stat-item.updated {
    color: #f59e0b;
    font-weight: bold;
}

.stat-item.deleted {
    color: #ef4444;
    font-weight: bold;
}

.card-time {
    font-size: 0.85em;
    color: #9ca3af;
}

.section {
    padding: 40px;
    border-top: 1px solid #e5e7eb;
}

.section h2 {
    font-size: 1.8em;
    margin-bottom: 24px;
    color: #1f2937;
}

.section h3 {
    font-size: 1.3em;
    margin: 20px 0 12px;
    color: #374151;
}

.section h4 {
    font-size: 1.1em;
    margin: 16px 0 8px;
    color: #4b5563;
}

.empty-message {
    color: #9ca3af;
    font-style: italic;
    text-align: center;
    padding: 40px;
}

.details-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.detail-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.detail-item summary {
    padding: 16px;
    background: #f9fafb;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: background 0.2s;
}

.detail-item summary:hover {
    background: #f3f4f6;
}

.detail-item[open] summary {
    background: #e5e7eb;
}

.table-name {
    font-weight: bold;
    font-family: 'Courier New', monospace;
}

.table-source {
    color: #6b7280;
    font-size: 0.9em;
}

.badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: bold;
}

.badge-created {
    background: #d1fae5;
    color: #065f46;
}

.badge-updated {
    background: #fed7aa;
    color: #92400e;
}

.detail-content {
    padding: 20px;
}

.detail-group {
    margin-bottom: 24px;
}

.change-list ul {
    list-style: none;
    margin-top: 8px;
}

.change-list li {
    padding: 8px 12px;
    margin: 4px 0;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

.change-list li.created {
    background: #d1fae5;
    color: #065f46;
}

.change-list li.updated {
    background: #fed7aa;
    color: #92400e;
}

.change-list li.deleted {
    background: #fee2e2;
    color: #991b1b;
}

.change-type {
    font-size: 0.85em;
    color: #6b7280;
    font-style: italic;
}

.sql-code {
    background: #1f2937;
    color: #10b981;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.9em;
    line-height: 1.6;
}

.api-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.api-item {
    padding: 12px;
    border-radius: 6px;
    border-left: 4px solid;
}

.api-item.created {
    background: #d1fae5;
    border-color: #10b981;
}

.api-item.updated {
    background: #fed7aa;
    border-color: #f59e0b;
}

.api-item.deleted {
    background: #fee2e2;
    border-color: #ef4444;
}

.api-header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
}

.api-method {
    font-weight: bold;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0,0,0,0.1);
    font-size: 0.85em;
}

.api-path {
    font-family: 'Courier New', monospace;
    flex: 1;
}

.api-name {
    color: #6b7280;
}

.api-addon {
    font-size: 0.85em;
    color: #9ca3af;
}

.api-changes {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(0,0,0,0.1);
}

.change-item {
    font-size: 0.9em;
    margin: 4px 0;
}

.old-value {
    color: #ef4444;
    text-decoration: line-through;
}

.new-value {
    color: #10b981;
    font-weight: bold;
}

.menu-list, .dev-list {
    list-style: none;
}

.menu-list li, .dev-list li {
    padding: 8px 12px;
    margin: 4px 0;
    border-radius: 4px;
}

.menu-list li.created, .dev-list li.created {
    background: #d1fae5;
}

.menu-list li.updated, .dev-list li.updated {
    background: #fed7aa;
}

.menu-list li.deleted, .dev-list li.deleted {
    background: #fee2e2;
}

.menu-list li.exists, .dev-list li.exists {
    background: #e5e7eb;
}

@media print {
    body {
        background: white;
        padding: 0;
    }

    .container {
        box-shadow: none;
    }

    .summary-card {
        break-inside: avoid;
    }
}
`;
}

/**
 * 获取内嵌的 JavaScript 代码
 */
function getEmbeddedJS(): string {
    return `
// 折叠/展开所有详情
function toggleAllDetails() {
    const details = document.querySelectorAll('details');
    const allOpen = Array.from(details).every(d => d.open);
    details.forEach(d => d.open = !allOpen);
}

// 搜索功能（预留）
function searchContent(keyword) {
    // TODO: 实现搜索功能
    console.log('Search:', keyword);
}

// 打印友好
window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details').forEach(d => d.open = true);
});

console.log('Befly 同步报告已加载', reportData);
`;
}
