import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import { IconComponent } from '../components/icon.component';
import { SettingsService } from '../services/settings.service';

const LAT_LNG_PATTERN = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normaliseLatLng(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!LAT_LNG_PATTERN.test(trimmed)) return null;
        return trimmed.replace(/\s+/g, '');
    }
    if (Array.isArray(value) && value.length === 2) {
        const [lat, lng] = value;
        if (isFiniteNumber(lat) && isFiniteNumber(lng)) return `${lat},${lng}`;
    }
    if (typeof value === 'object') {
        const v = value as Record<string, unknown>;
        const lat = v['lat'] ?? v['latitude'];
        const lng = v['lng'] ?? v['lon'] ?? v['long'] ?? v['longitude'];
        if (isFiniteNumber(lat) && isFiniteNumber(lng)) return `${lat},${lng}`;
        if (typeof lat === 'string' && typeof lng === 'string') {
            return normaliseLatLng(`${lat},${lng}`);
        }
    }
    return null;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

@Component({
    selector: 'wayfinding-page',
    imports: [IconComponent],
    template: `
        <div class="h-full w-full bg-gray-200">
            @if (embed_url(); as url) {
                <iframe
                    [src]="safe_url()"
                    class="h-full w-full border-0"
                    loading="lazy"
                    allowfullscreen
                    referrerpolicy="no-referrer-when-downgrade"
                    title="Wayfinding map"
                ></iframe>
            } @else {
                <div
                    class="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center opacity-60"
                >
                    <icon class="text-8xl">location_off</icon>
                    <p>{{ error_message() }}</p>
                </div>
            }
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
        `,
    ],
})
export class WayfindingPage {
    private readonly _route = inject(ActivatedRoute);
    private readonly _sanitizer = inject(DomSanitizer);
    private readonly _settings = inject(SettingsService);

    readonly maps_api_key = this._settings.signal<unknown>('maps_api_key', '');
    readonly default_location = this._settings.signal<unknown>('default_location', '');

    readonly destination = toSignal(
        this._route.queryParamMap.pipe(
            map((params) => {
                const lat = params.get('lat');
                const lng = params.get('lng') || params.get('long');
                if (!lat || !lng) return null;
                return normaliseLatLng(`${lat},${lng}`);
            }),
        ),
        { initialValue: null as string | null },
    );

    readonly embed_url = computed<string | null>(() => {
        const key = asString(this.maps_api_key()).trim();
        const origin = normaliseLatLng(this.default_location());
        if (!key || !origin) return null;
        const destination = this.destination();
        const params = new URLSearchParams({ key });
        if (destination) {
            params.set('origin', origin);
            params.set('destination', destination);
            params.set('mode', 'walking');
            return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
        }
        params.set('q', origin);
        return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
    });

    readonly safe_url = computed<SafeResourceUrl | null>(() => {
        const url = this.embed_url();
        return url ? this._sanitizer.bypassSecurityTrustResourceUrl(url) : null;
    });

    readonly error_message = computed<string>(() => {
        if (!asString(this.maps_api_key()).trim()) return 'Maps API key is not configured.';
        if (!normaliseLatLng(this.default_location())) return 'Default location is not configured.';
        return 'Map unavailable.';
    });
}
