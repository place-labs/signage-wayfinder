import { Injectable, WritableSignal, signal } from '@angular/core';
import { authority, isMock, queryZones, showMetadata } from '@placeos/ts-client';
import { catchError, lastValueFrom, of } from 'rxjs';

import { DEFAULT_SETTINGS } from '../../environments/settings';

const APP_METADATA_KEY = 'wayfinder_app';
const LOCATION_OVERRIDE_STORAGE_KEY = 'wayfinder.default_location_override';

type HashMap<T = unknown> = Record<string, T>;

function readStoredLocationOverride(): string | null {
    try {
        return sessionStorage?.getItem(LOCATION_OVERRIDE_STORAGE_KEY) ?? null;
    } catch {
        return null;
    }
}

function writeStoredLocationOverride(value: string): void {
    try {
        sessionStorage?.setItem(LOCATION_OVERRIDE_STORAGE_KEY, value);
    } catch {
        /* storage unavailable — ignore */
    }
}

const QUERY_OVERRIDES: HashMap = (() => {
    if (typeof location === 'undefined') return {};
    const search = location.search || location.hash.split('?')[1] || '';
    const params = new URLSearchParams(search.replace(/^\?/, ''));
    const raw = params.get('location');
    if (raw) {
        const [lat, lng] = raw.split(',').map((v) => v.trim());
        const lat_num = Number(lat);
        const lng_num = Number(lng);
        if (lat && lng && Number.isFinite(lat_num) && Number.isFinite(lng_num)) {
            const value = `${lat_num},${lng_num}`;
            writeStoredLocationOverride(value);
            return { default_location: value };
        }
    }
    const stored = readStoredLocationOverride();
    if (stored) return { default_location: stored };
    return {};
})();

function getByPath(path: string[], source: HashMap | undefined): unknown {
    if (!source) return undefined;
    let value: unknown = source;
    for (const key of path) {
        if (value == null || typeof value !== 'object') return undefined;
        value = (value as HashMap)[key];
    }
    return value;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private readonly _signals: Record<string, WritableSignal<unknown>> = {};

    private _organisation_id: string | null = null;
    private _overrides: HashMap = {};
    private readonly _query_overrides: HashMap = QUERY_OVERRIDES;

    async init(): Promise<void> {
        await this._loadOrganisation();
        await this._loadAppMetadata();
        this._refreshSignals();
    }

    get<T = unknown>(key: string): T | undefined {
        const keys = key.split('.');
        if (keys[0] === 'app') {
            const query = getByPath(keys.slice(1), this._query_overrides);
            if (query != null) return query as T;
            const override = getByPath(keys.slice(1), this._overrides);
            if (override != null) return override as T;
        }
        return getByPath(keys, DEFAULT_SETTINGS as unknown as HashMap) as T | undefined;
    }

    signal<T = unknown>(key: string, default_value?: T): WritableSignal<T> {
        const full_key = key.startsWith('app.') ? key : `app.${key}`;
        if (!this._signals[full_key]) {
            this._signals[full_key] = signal(this.get(full_key) ?? default_value);
        }
        return this._signals[full_key] as WritableSignal<T>;
    }

    async reload(): Promise<void> {
        await this._loadAppMetadata();
        this._refreshSignals();
    }

    private async _loadOrganisation(): Promise<void> {
        const org_list = await lastValueFrom(
            queryZones({ tags: 'org', include_children_count: true }).pipe(
                catchError(() => of({ data: [] } as { data: Array<{ id: string }> })),
            ),
        );
        const zones = (org_list as { data?: Array<{ id: string }> }).data ?? [];
        if (!zones.length) {
            console.warn('SettingsService: no organisation zones found');
            return;
        }
        const auth = authority();
        const org_zone = (auth as { config?: { org_zone?: string } } | undefined)?.config?.org_zone;
        const org = zones.find((zone) => isMock() || zone.id === org_zone) ?? zones[0];
        this._organisation_id = org.id;
    }

    private async _loadAppMetadata(): Promise<void> {
        if (!this._organisation_id) {
            this._overrides = {};
            return;
        }
        const metadata = await lastValueFrom(
            showMetadata(this._organisation_id, APP_METADATA_KEY).pipe(
                catchError(() => of({ details: {} as HashMap })),
            ),
        );
        this._overrides = (metadata as { details?: HashMap } | undefined)?.details ?? {};
    }

    private _refreshSignals(): void {
        for (const key of Object.keys(this._signals)) {
            this._signals[key].set(this.get(key));
        }
    }
}
