import { Injectable, inject, signal } from '@angular/core';
import {
    currentUser,
    invalidateToken,
    isOnline,
    logout,
    onlineState,
    setAPI_Key,
    token,
} from '@placeos/ts-client';
import { Observable } from 'rxjs';

import { DEFAULT_SETTINGS } from '../../environments/settings';
import { SettingsService } from './settings.service';
import { setupPlace } from './setup-place';

@Injectable({ providedIn: 'root' })
export class PlaceOSService {
    private readonly _settings = inject(SettingsService);

    readonly ready = signal(false);
    readonly online = signal(false);

    async init(): Promise<void> {
        const params = new URLSearchParams(location.search);
        if (params.has('x-api-key')) setAPI_Key(params.get('x-api-key')!);

        await setupPlace(DEFAULT_SETTINGS.composer).catch((err) =>
            console.error('PlaceOS setup failed', err),
        );

        onlineState().subscribe((value) => this.online.set(value));

        await this._settings.init().catch((err) => console.error('Settings init failed', err));

        this.ready.set(true);
    }

    get user$(): Observable<unknown> {
        return currentUser();
    }

    get token(): string {
        return token();
    }

    isAuthenticated(): boolean {
        return isOnline();
    }

    invalidate(): void {
        invalidateToken();
    }

    logout(): void {
        logout();
    }
}
