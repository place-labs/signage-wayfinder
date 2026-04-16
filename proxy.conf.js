/** FQDN to proxy requests to. No protocol or path. */
const domain = 'placeos-nonprod.avit.it.ucla.edu';
/** Whether the proxied endpoints use SSL */
const secure = true;
/** Whether the SSL certificate is valid */
const valid_ssl = true;

const PROXY_CONFIG = {};

const context = ['/control', '/auth', '/api', '/styles', '/scripts', '/login', '/backoffice', '/r'];
const ws_context = ['/control/websocket', '/api'];

function add(endpoint, extras = {}) {
    PROXY_CONFIG[`${endpoint}/**`] = {
        target: `http${secure ? 's' : ''}://${domain}`,
        secure: valid_ssl,
        changeOrigin: true,
        ...extras,
    };
}

context.forEach((e) => add(e));
ws_context.forEach((e) => add(e, { ws: true }));

module.exports = PROXY_CONFIG;
