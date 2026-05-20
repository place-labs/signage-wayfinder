import {
    AfterViewInit,
    Component,
    ElementRef,
    ViewChild,
    computed,
    inject,
    signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { IconComponent } from '../components/icon.component';
import { VirtualKeyboardDirective } from '../components/virtual-keyboard.component';
import { LocateService, PlaceSuggestion } from '../services/locate.service';
import { SettingsService } from '../services/settings.service';
import { SystemService } from '../services/system.service';

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

interface SearchState {
    suggestions: PlaceSuggestion[];
    loading: boolean;
    error: string | null;
}

const SEARCH_INITIAL: SearchState = { suggestions: [], loading: false, error: null };

@Component({
    selector: 'wayfinding-page',
    imports: [IconComponent, VirtualKeyboardDirective],
    template: `
        <div class="relative h-full w-full bg-gray-200">
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

            @if (!destination() && has_places_key()) {
                <div
                    class="pointer-events-none absolute top-0 right-0 left-0 z-10 flex justify-center p-4 sm:p-6"
                >
                    <div class="pointer-events-auto w-full max-w-xl">
                        <div class="relative">
                            <icon
                                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-gray-500"
                                >search</icon
                            >
                            <input
                                #input
                                keyboard
                                type="search"
                                autocomplete="off"
                                placeholder="Search for a location…"
                                inputmode="none"
                                class="w-full rounded-xl border border-gray-300 bg-white py-3 pr-10 pl-10 text-base shadow-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                [value]="search()"
                                (input)="onSearch($any($event.target).value)"
                                (focus)="focused.set(true)"
                                (blur)="onBlur()"
                            />
                            @if (search()) {
                                <button
                                    type="button"
                                    class="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                                    aria-label="Clear search"
                                    (click)="onSearch('')"
                                >
                                    <icon>close</icon>
                                </button>
                            }
                        </div>

                        @if (show_dropdown()) {
                            <div
                                class="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
                            >
                                @if (search_state().loading) {
                                    <div class="flex items-center gap-2 p-3 text-sm text-gray-600">
                                        <icon class="animate-spin text-lg">progress_activity</icon>
                                        <span>Searching…</span>
                                    </div>
                                } @else if (search_state().error) {
                                    <div class="flex items-center gap-2 p-3 text-sm text-red-600">
                                        <icon class="text-lg">error</icon>
                                        <span>{{ search_state().error }}</span>
                                    </div>
                                } @else if (search_state().suggestions.length === 0) {
                                    <div class="p-3 text-sm text-gray-500">No matches.</div>
                                } @else {
                                    <ul class="flex max-h-80 flex-col overflow-y-auto">
                                        @for (s of search_state().suggestions; track s.place_id) {
                                            <li>
                                                <button
                                                    type="button"
                                                    class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-60"
                                                    [disabled]="!!picking_id()"
                                                    (mousedown)="onPick(s); $event.preventDefault()"
                                                >
                                                    <icon class="text-gray-500">place</icon>
                                                    <div class="flex min-w-0 flex-1 flex-col">
                                                        <span
                                                            class="truncate text-sm font-medium text-gray-900"
                                                        >
                                                            {{ s.main_text }}
                                                        </span>
                                                        @if (s.secondary_text) {
                                                            <span
                                                                class="truncate text-xs text-gray-500"
                                                            >
                                                                {{ s.secondary_text }}
                                                            </span>
                                                        }
                                                    </div>
                                                    @if (picking_id() === s.place_id) {
                                                        <icon class="animate-spin text-gray-500"
                                                            >progress_activity</icon
                                                        >
                                                    }
                                                </button>
                                            </li>
                                        }
                                    </ul>
                                }
                            </div>
                        }

                        @if (pick_error(); as err) {
                            <p
                                class="mt-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-sm text-red-600 shadow"
                                role="alert"
                            >
                                <icon class="text-base">error</icon>
                                <span>{{ err }}</span>
                            </p>
                        }
                    </div>
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
export class WayfindingPage implements AfterViewInit {
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _sanitizer = inject(DomSanitizer);
    private readonly _settings = inject(SettingsService);
    private readonly _locate = inject(LocateService);
    private readonly _systems = inject(SystemService);

    @ViewChild('input', { read: ElementRef })
    private readonly _input?: ElementRef<HTMLInputElement>;

    ngAfterViewInit(): void {
        queueMicrotask(() => this._input?.nativeElement.focus());
    }

    readonly maps_api_key = this._settings.signal<unknown>('maps_api_key', '');
    readonly places_api_key = this._settings.signal<unknown>('places_api_key', '');
    readonly default_location = this._settings.signal<unknown>('default_location', '');

    readonly search = signal('');
    readonly focused = signal(false);
    readonly picking_id = signal<string | null>(null);
    readonly pick_error = signal<string | null>(null);

    readonly has_places_key = computed(() => !!asString(this.places_api_key()).trim());

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

    private readonly _search_state$ = toObservable(this.search).pipe(
        map((v) => v.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
            if (query.length < 2) return of(SEARCH_INITIAL);
            const bias = normaliseLatLng(this.default_location());
            return this._locate.autocomplete(query, bias).pipe(
                map((suggestions) => ({ suggestions, loading: false, error: null })),
                catchError((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Search failed.';
                    return of({ suggestions: [], loading: false, error: message });
                }),
            );
        }),
    );

    readonly search_state = toSignal(this._search_state$, { initialValue: SEARCH_INITIAL });

    readonly show_dropdown = computed(() => this.focused() && this.search().trim().length >= 2);

    onSearch(value: string): void {
        this.search.set(value);
        this.pick_error.set(null);
    }

    onBlur(): void {
        setTimeout(() => this.focused.set(false), 150);
    }

    onPick(suggestion: PlaceSuggestion): void {
        if (this.picking_id()) return;
        this.picking_id.set(suggestion.place_id);
        this.pick_error.set(null);
        this._locate.lookupPlace(suggestion.place_id).subscribe({
            next: ({ lat, lng }) => {
                this.picking_id.set(null);
                this.focused.set(false);
                this.search.set('');
                this._router.navigate(this._wayfindingCommands(), {
                    queryParams: { lat, lng },
                    queryParamsHandling: 'merge',
                });
            },
            error: (err: unknown) => {
                this.picking_id.set(null);
                const message = err instanceof Error ? err.message : 'Unable to locate place.';
                this.pick_error.set(message);
            },
        });
    }

    private _wayfindingCommands(): unknown[] {
        const sys = this._systems.system();
        return sys ? ['/', sys, 'wayfinding'] : ['/wayfinding'];
    }
}
