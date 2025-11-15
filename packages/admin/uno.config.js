import { defineConfig, presetAttributify, presetUno } from 'unocss';

export default defineConfig({
    presets: [presetUno(), presetAttributify()],
    shortcuts: {
        'flex-center': 'flex items-center justify-center',
        'flex-between': 'flex items-center justify-between',
        'flex-col-center': 'flex flex-col items-center justify-center'
    },
    theme: {
        colors: {
            primary: '#1890ff',
            success: '#52c41a',
            warning: '#faad14',
            danger: '#ff4d4f',
            info: '#1890ff'
        }
    }
});
