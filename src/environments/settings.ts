export interface AppSettings {
    composer: {
        protocol: 'http:' | 'https:' | '';
        domain: string;
        port: string;
        route: string;
        use_domain: boolean;
        local_login: boolean;
        mock: boolean;
    };
    app: {
        name: string;
    };
}

export const DEFAULT_SETTINGS: AppSettings = {
    composer: {
        protocol: '',
        domain: '',
        port: '',
        route: '/signage-wayfinder',
        use_domain: false,
        local_login: false,
        mock: false,
    },
    app: {
        name: 'Signage Wayfinder',
    },
};
