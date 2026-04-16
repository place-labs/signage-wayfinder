import { PlaceAuthOptions, setup } from '@placeos/ts-client';

export interface PlaceSettings {
    protocol: 'http:' | 'https:' | '';
    domain: string;
    port: string | number;
    route: string;
    use_domain: boolean;
    local_login: boolean;
    mock: boolean;
}

export async function setupPlace(settings: PlaceSettings): Promise<void> {
    const protocol = settings.protocol || location.protocol;
    const host = settings.domain || location.hostname;
    const port = settings.port || location.port;
    const host_with_port = `${host}${port ? ':' + port : ''}`;
    const url = settings.use_domain ? `${protocol}//${host_with_port}` : location.origin;
    const route = (location.pathname + '/').replace('//', '/');
    const mock =
        settings.mock ||
        location.href.includes('mock=true') ||
        localStorage.getItem('mock') === 'true';

    const config: PlaceAuthOptions = {
        auth_type: 'auth_code',
        scope: 'public',
        host: host_with_port,
        secure: protocol === 'https:',
        auth_uri: `${url}/auth/oauth/authorize`,
        token_uri: `${url}/auth/oauth/token`,
        redirect_uri: `${location.origin}${route}oauth-resp.html`,
        handle_login: !settings.local_login,
        use_iframe: true,
        mock,
        delay: 300,
    };

    localStorage.setItem('mock', `${!!mock && !location.href.includes('mock=false')}`);

    return setup(config);
}
