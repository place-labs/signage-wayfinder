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
        /** Google Maps Embed API key */
        maps_api_key: string;
        /** Google Places API key (used for LLM-assisted user location lookup) */
        places_api_key: string;
        /** Default map centre and walking-directions origin, formatted "lat,lng" */
        default_location: string;
        /** Prompt seed passed to the LLM module; the selected user's office_location is appended */
        llm_prompt: string;
        /** Prefix prepended to the LLM response before the Places API text search */
        llm_prefix: string;
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
        idle_timeout_secs: 60,
        maps_api_key: '',
        places_api_key: '',
        default_location: '',
        llm_prompt:
            'Identify the real-world street address or named place for the following office location. Respond with only the address or place name, no extra commentary. If you cannot identify a real-world location, respond with exactly NOT_FOUND. Office location: ',
        llm_prefix: '',
    },
};
