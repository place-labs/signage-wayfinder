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
        signage_url: string;
        /** Delay in seconds before returning to signage from any sub-route */
        idle_timeout_secs: number;
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
        signage_url: 'https://placeos-nonprod.avit.it.ucla.edu/signage',
        idle_timeout_secs: 1 * 60,
    },
};
