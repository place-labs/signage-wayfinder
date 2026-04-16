import { Injectable, WritableSignal, signal } from '@angular/core';
import { authority, isMock, queryZones, showMetadata } from '@placeos/ts-client';
import { BehaviorSubject, Observable, catchError, lastValueFrom, of } from 'rxjs';

import { AppSettings, DEFAULT_SETTINGS } from '../../environments/settings';

const APP_METADATA_KEY = 'wayfinder_app';

type HashMap<T = unknown> = Record<string, T>;

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
    private readonly _initialised = new BehaviorSubject(false);
    private readonly _overrides = new BehaviorSubject<HashMap>({});
    private readonly _signals: Record<string, WritableSignal<unknown>> = {};

    private _organisation_id: string | null = null;

    readonly ready = signal(false);

    readonly initialised: Observable<boolean> = this._initialised.asObservable();
    readonly overrides$: Observable<HashMap> = this._overrides.asObservable();

    async init(): Promise<void> {
        await this._loadOrganisation();
        await this._loadAppMetadata();
        this._refreshSignals();
        this._initialised.next(true);
        this.ready.set(true);
    }

    get organisationId(): string | null {
        return this._organisation_id;
    }

    get<T = unknown>(key: string): T | undefined {
        const keys = key.split('.');
        if (keys[0] === 'app') {
            const override = getByPath(keys.slice(1), this._overrides.getValue());
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
            this._overrides.next({});
            return;
        }
        const metadata = await lastValueFrom(
            showMetadata(this._organisation_id, APP_METADATA_KEY).pipe(
                catchError(() => of({ details: {} as HashMap })),
            ),
        );
        const details = (metadata as { details?: HashMap } | undefined)?.details ?? {};
        this._overrides.next(details);
    }

    private _refreshSignals(): void {
        for (const key of Object.keys(this._signals)) {
            this._signals[key].set(this.get(key));
        }
    }
}

export type { AppSettings };
