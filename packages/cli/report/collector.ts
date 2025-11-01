/**
 * 同步报告数据收集器
 * 单例模式，用于在各个同步命令中收集详细数据
 */

import type { SyncReport, TableChangeDetail, ApiDetail, ApiDetailWithDiff, MenuTreeNode, MenuDetail, MenuDetailWithDiff, AdminDetail, RoleDetail } from '../types.js';

export class ReportCollector {
    private static instance: ReportCollector;
    private data: Partial<SyncReport> = {};
    private timers: Map<string, number> = new Map();

    private constructor() {
        this.reset();
    }

    static getInstance(): ReportCollector {
        if (!ReportCollector.instance) {
            ReportCollector.instance = new ReportCollector();
        }
        return ReportCollector.instance;
    }

    /**
     * 重置收集器数据
     */
    reset(): void {
        this.data = {
            meta: {
                timestamp: Date.now(),
                timestampStr: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                totalTime: 0,
                status: 'success'
            },
            database: {
                stats: {
                    processedTables: 0,
                    createdTables: 0,
                    modifiedTables: 0,
                    addFields: 0,
                    nameChanges: 0,
                    typeChanges: 0,
                    minChanges: 0,
                    maxChanges: 0,
                    defaultChanges: 0,
                    indexCreate: 0,
                    indexDrop: 0
                },
                details: {
                    tables: []
                },
                timing: {
                    validation: 0,
                    connection: 0,
                    scanning: 0,
                    processing: 0
                }
            },
            api: {
                stats: {
                    totalApis: 0,
                    projectApis: 0,
                    addonApis: 0,
                    created: 0,
                    updated: 0,
                    deleted: 0
                },
                details: {
                    bySource: {
                        project: [],
                        addons: {}
                    },
                    byAction: {
                        created: [],
                        updated: [],
                        deleted: []
                    }
                },
                timing: {
                    scanning: 0,
                    processing: 0,
                    caching: 0
                }
            },
            menu: {
                stats: {
                    totalMenus: 0,
                    parentMenus: 0,
                    childMenus: 0,
                    created: 0,
                    updated: 0,
                    deleted: 0
                },
                details: {
                    tree: [],
                    byAction: {
                        created: [],
                        updated: [],
                        deleted: []
                    }
                },
                timing: {
                    scanning: 0,
                    processing: 0,
                    caching: 0
                }
            },
            dev: {
                stats: {
                    adminCount: 0,
                    roleCount: 0,
                    cachedRoles: 0
                },
                details: {
                    admins: [],
                    roles: []
                },
                timing: {
                    processing: 0,
                    caching: 0
                }
            }
        };
        this.timers.clear();
    }

    // ==================== 计时器方法 ====================

    startTimer(key: string): void {
        this.timers.set(key, Date.now());
    }

    endTimer(key: string): number {
        const start = this.timers.get(key);
        if (!start) return 0;
        const duration = Date.now() - start;
        this.timers.delete(key);
        return duration;
    }

    // ==================== 数据库相关方法 ====================

    setDatabaseStats(stats: Partial<typeof this.data.database.stats>): void {
        if (this.data.database) {
            this.data.database.stats = { ...this.data.database.stats, ...stats };
        }
    }

    addTableChange(table: TableChangeDetail): void {
        if (this.data.database?.details.tables) {
            this.data.database.details.tables.push(table);
        }
    }

    setDatabaseTiming(key: keyof typeof this.data.database.timing, value: number): void {
        if (this.data.database) {
            this.data.database.timing[key] = value;
        }
    }

    // ==================== 接口相关方法 ====================

    setApiStats(stats: Partial<typeof this.data.api.stats>): void {
        if (this.data.api) {
            this.data.api.stats = { ...this.data.api.stats, ...stats };
        }
    }

    setApiBySource(source: 'project' | string, apis: ApiDetail[]): void {
        if (!this.data.api?.details.bySource) return;

        if (source === 'project') {
            this.data.api.details.bySource.project = apis;
        } else {
            this.data.api.details.bySource.addons[source] = apis;
        }
    }

    setApiByAction(action: 'created' | 'updated' | 'deleted', apis: ApiDetail[] | ApiDetailWithDiff[]): void {
        if (!this.data.api?.details.byAction) return;
        this.data.api.details.byAction[action] = apis as any;
    }

    setApiTiming(key: keyof typeof this.data.api.timing, value: number): void {
        if (this.data.api) {
            this.data.api.timing[key] = value;
        }
    }

    // ==================== 菜单相关方法 ====================

    setMenuStats(stats: Partial<typeof this.data.menu.stats>): void {
        if (this.data.menu) {
            this.data.menu.stats = { ...this.data.menu.stats, ...stats };
        }
    }

    setMenuTree(tree: MenuTreeNode[]): void {
        if (this.data.menu?.details) {
            this.data.menu.details.tree = tree;
        }
    }

    setMenuByAction(action: 'created' | 'updated' | 'deleted', menus: MenuDetail[] | MenuDetailWithDiff[]): void {
        if (!this.data.menu?.details.byAction) return;
        this.data.menu.details.byAction[action] = menus as any;
    }

    setMenuTiming(key: keyof typeof this.data.menu.timing, value: number): void {
        if (this.data.menu) {
            this.data.menu.timing[key] = value;
        }
    }

    // ==================== 开发账号相关方法 ====================

    setDevStats(stats: Partial<typeof this.data.dev.stats>): void {
        if (this.data.dev) {
            this.data.dev.stats = { ...this.data.dev.stats, ...stats };
        }
    }

    setDevAdmins(admins: AdminDetail[]): void {
        if (this.data.dev?.details) {
            this.data.dev.details.admins = admins;
        }
    }

    setDevRoles(roles: RoleDetail[]): void {
        if (this.data.dev?.details) {
            this.data.dev.details.roles = roles;
        }
    }

    setDevTiming(key: keyof typeof this.data.dev.timing, value: number): void {
        if (this.data.dev) {
            this.data.dev.timing[key] = value;
        }
    }

    // ==================== 元信息相关方法 ====================

    setTotalTime(time: number): void {
        if (this.data.meta) {
            this.data.meta.totalTime = time;
        }
    }

    setStatus(status: 'success' | 'error', error?: string): void {
        if (this.data.meta) {
            this.data.meta.status = status;
            if (error) {
                this.data.meta.error = error;
            }
        }
    }

    // ==================== 获取数据 ====================

    getData(): SyncReport {
        return this.data as SyncReport;
    }
}
