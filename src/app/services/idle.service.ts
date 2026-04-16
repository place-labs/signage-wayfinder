import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SettingsService } from './settings.service';

const DEFAULT_TIMEOUT_SECS = 60;
const IDLE_EVENTS: Array<keyof DocumentEventMap> = [
    'pointerdown',
    'keydown',
    'touchstart',
    'wheel',
];

@Injectable({ providedIn: 'root' })
export class IdleService {
    private readonly _router = inject(Router);
    private readonly _settings = inject(SettingsService);
    private readonly _destroy = inject(DestroyRef);

    private readonly _timeout_signal = this._settings.signal<number>(
        'idle_timeout_secs',
        DEFAULT_TIMEOUT_SECS,
    );

    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _started = false;

    private readonly _reset = () => {
        if (this._timer) clearTimeout(this._timer);
        const secs = this._timeout_signal() || DEFAULT_TIMEOUT_SECS;
        this._timer = setTimeout(() => this._onIdle(), secs * 1000);
    };

    constructor() {
        effect(() => {
            this._timeout_signal();
            if (this._started) this._reset();
        });

        this._destroy.onDestroy(() => this.stop());
    }

    start(): void {
        if (this._started) return;
        this._started = true;
        for (const event of IDLE_EVENTS) {
            document.addEventListener(event, this._reset, { passive: true });
        }
        this._reset();
    }

    stop(): void {
        if (!this._started) return;
        this._started = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        for (const event of IDLE_EVENTS) {
            document.removeEventListener(event, this._reset);
        }
    }

    private _onIdle(): void {
        if (this._router.url === '/' || this._router.url.startsWith('/?')) {
            this._reset();
            return;
        }
        this._router.navigateByUrl('/');
    }
}
