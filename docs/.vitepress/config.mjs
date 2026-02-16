import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'Inertia UI Vanilla Documentation',
    description: 'Documentation for the @inertiaui/vanilla package',
    themeConfig: {
        nav: [
            { text: 'Documentation', link: '/introduction' },
            { text: 'Inertia UI portal', link: 'https://inertiaui.com/dashboard' },
        ],

        search: { provider: 'local' },

        sidebar: [
            {
                text: 'Getting Started',
                items: [
                    { text: 'Introduction', link: '/introduction' },
                    { text: 'Installation', link: '/installation' },
                ],
            },
            {
                text: 'Dialog Utilities',
                items: [
                    { text: 'createDialog', link: '/create-dialog' },
                    { text: 'Scroll Locking', link: '/scroll-locking' },
                    { text: 'Focus Management', link: '/focus-management' },
                    { text: 'Event Handlers', link: '/event-handlers' },
                    { text: 'Accessibility', link: '/accessibility' },
                ],
            },
            {
                text: 'Helper Utilities',
                items: [
                    { text: 'generateId', link: '/generate-id' },
                    { text: 'Object Filtering', link: '/object-filtering' },
                    { text: 'String Utilities', link: '/string-utilities' },
                ],
            },
        ],

        aside: false,

        socialLinks: [
            { icon: 'github', link: 'https://github.com/inertiaui' },
            { icon: 'twitter', link: 'https://twitter.com/pascalbaljet' },
        ],
    },
})
