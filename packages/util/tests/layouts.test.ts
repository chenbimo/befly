import { describe, it, expect } from 'bun:test';
import { Layouts, type RouteConfig } from '../src/layouts';

describe('Layouts', () => {
    it('should handle simple routes with default layout', () => {
        const routes: RouteConfig[] = [{ path: 'home', component: 'HomeComponent' }];
        const result = Layouts(routes);
        expect(result).toEqual([{ path: 'home', layoutName: 'default', component: 'HomeComponent', meta: undefined }]);
    });

    it('should handle routes with specified layout suffix', () => {
        const routes: RouteConfig[] = [{ path: 'login_1', component: 'LoginComponent' }];
        const result = Layouts(routes);
        expect(result).toEqual([{ path: 'login', layoutName: '1', component: 'LoginComponent', meta: undefined }]);
    });

    it('should handle index routes correctly', () => {
        const routes: RouteConfig[] = [{ path: 'index', component: 'IndexComponent' }];
        const result = Layouts(routes);
        expect(result).toEqual([{ path: '', layoutName: 'default', component: 'IndexComponent', meta: undefined }]);
    });

    it('should handle index routes with layout suffix', () => {
        const routes: RouteConfig[] = [{ path: 'index_2', component: 'IndexComponent' }];
        const result = Layouts(routes);
        expect(result).toEqual([{ path: '', layoutName: '2', component: 'IndexComponent', meta: undefined }]);
    });

    it('should handle nested routes and inherit layout', () => {
        const routes: RouteConfig[] = [
            {
                path: 'admin_3',
                children: [
                    { path: 'dashboard', component: 'DashboardComponent' },
                    { path: 'settings_4', component: 'SettingsComponent' }
                ]
            }
        ];
        const result = Layouts(routes);
        expect(result).toHaveLength(2);

        // Inherited layout '3'
        expect(result[0]).toEqual({
            path: 'admin/dashboard',
            layoutName: '3',
            component: 'DashboardComponent',
            meta: undefined
        });

        // Overridden layout '4'
        expect(result[1]).toEqual({
            path: 'admin/settings',
            layoutName: '4',
            component: 'SettingsComponent',
            meta: undefined
        });
    });

    it('should handle deep nesting', () => {
        const routes: RouteConfig[] = [
            {
                path: 'a_1',
                children: [
                    {
                        path: 'b',
                        children: [{ path: 'c', component: 'CComponent' }]
                    }
                ]
            }
        ];
        const result = Layouts(routes);
        expect(result).toEqual([{ path: 'a/b/c', layoutName: '1', component: 'CComponent', meta: undefined }]);
    });

    it('should handle path cleaning correctly', () => {
        const routes: RouteConfig[] = [
            {
                path: 'users_5',
                children: [
                    { path: 'list', component: 'ListComponent' },
                    { path: 'detail_6', component: 'DetailComponent' }
                ]
            }
        ];
        const result = Layouts(routes);

        expect(result[0].path).toBe('users/list');
        expect(result[0].layoutName).toBe('5');

        expect(result[1].path).toBe('users/detail');
        expect(result[1].layoutName).toBe('6');
    });
});
