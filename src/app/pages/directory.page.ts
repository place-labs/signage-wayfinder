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
import { Router } from '@angular/router';
import { executeOnSystem } from '@placeos/ts-client';
import { combineLatest, of } from 'rxjs';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    map,
    startWith,
    switchMap,
} from 'rxjs/operators';

import { IconComponent } from '../components/icon.component';
import { VirtualKeyboardDirective } from '../components/virtual-keyboard.component';
import { DirectoryUser, LocateService, LocationNotFoundError } from '../services/locate.service';
import { SystemService } from '../services/system.service';

interface DirectoryState {
    users: DirectoryUser[];
    loading: boolean;
    error: boolean;
}

const INITIAL_STATE: DirectoryState = { users: [], loading: false, error: false };

@Component({
    selector: 'directory-page',
    imports: [IconComponent, VirtualKeyboardDirective],
    template: `
        <div
            class="flex h-full w-full flex-col bg-[var(--mat-sys-surface)] text-[var(--mat-sys-on-surface)]"
        >
            <header class="flex shrink-0 flex-col gap-3 p-4 sm:p-6">
                <h1 class="text-2xl font-semibold">Directory</h1>
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
                        inputmode="none"
                        placeholder="Search users by name or email…"
                        class="w-full rounded-xl border border-gray-300 bg-white py-3 pr-10 pl-10 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        [value]="search()"
                        (input)="onSearch($any($event.target).value)"
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
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
                @if (!system()) {
                    <div class="flex h-full flex-col items-center justify-center gap-3 opacity-60">
                        <icon class="text-6xl">sensors_off</icon>
                        <p>No system configured. Add <code>?system=sys-xxx</code> to the URL.</p>
                    </div>
                } @else if (search_length() < 2) {
                    <div class="flex h-full flex-col items-center justify-center gap-3 opacity-60">
                        <icon class="text-6xl">person_search</icon>
                        <p>Enter at least 2 characters to search.</p>
                    </div>
                } @else if (state().loading) {
                    <div class="flex h-full flex-col items-center justify-center gap-3 opacity-60">
                        <icon class="animate-spin text-5xl">progress_activity</icon>
                        <p>Searching…</p>
                    </div>
                } @else if (state().error) {
                    <div
                        class="flex h-full flex-col items-center justify-center gap-3 text-red-600"
                    >
                        <icon class="text-6xl">error</icon>
                        <p>Unable to load users. Try again.</p>
                    </div>
                } @else if (users().length === 0) {
                    <div class="flex h-full flex-col items-center justify-center gap-3 opacity-60">
                        <icon class="text-6xl">person_off</icon>
                        <p>No users found with an office location.</p>
                    </div>
                } @else {
                    <ul class="flex flex-col gap-2">
                        @for (user of users(); track trackUser($index, user)) {
                            @let user_key = trackUser($index, user);
                            @let is_active = locating_id() === user_key;
                            <li>
                                <button
                                    type="button"
                                    class="flex w-full items-center gap-2 rounded-xl bg-white p-2 text-left shadow-sm ring-1 ring-gray-100 transition hover:bg-blue-50 hover:ring-blue-200 disabled:opacity-60"
                                    [disabled]="!!locating_id()"
                                    (click)="onSelect(user, user_key)"
                                >
                                    <div
                                        class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-lg font-semibold text-blue-700"
                                    >
                                        @if (is_active) {
                                            <icon class="animate-spin text-2xl"
                                                >progress_activity</icon
                                            >
                                        } @else if (user.photo) {
                                            <img
                                                [src]="user.photo"
                                                alt=""
                                                class="h-full w-full object-cover"
                                            />
                                        } @else {
                                            <span>{{ initials(user) }}</span>
                                        }
                                    </div>
                                    <div class="flex min-w-0 flex-1 flex-col">
                                        <div class="flex min-w-0 items-baseline gap-2 truncate">
                                            <span
                                                class="truncate text-base font-semibold text-gray-900"
                                            >
                                                {{ user.name || user.email }}
                                            </span>
                                            @if (user.email && user.name) {
                                                <span
                                                    class="truncate font-mono text-sm font-normal text-gray-500"
                                                >
                                                    {{ user.email }}
                                                </span>
                                            }
                                        </div>
                                        <div
                                            class="flex items-center gap-1 truncate text-sm text-gray-500"
                                        >
                                            <icon class="-ml-1 text-base">place</icon>
                                            <span class="truncate">{{ user.office_location }}</span>
                                        </div>
                                    </div>
                                    <icon class="text-gray-400">chevron_right</icon>
                                </button>
                            </li>
                        }
                    </ul>
                    @if (locate_error(); as err) {
                        <p class="mt-3 flex items-center gap-1 text-sm text-red-600" role="alert">
                            <icon class="text-base">error</icon>
                            <span>{{ err }}</span>
                        </p>
                    }
                }
            </div>
        </div>
    `,
})
export class DirectoryPage implements AfterViewInit {
    private readonly _systems = inject(SystemService);
    private readonly _locate = inject(LocateService);
    private readonly _router = inject(Router);

    @ViewChild('input', { read: ElementRef })
    private readonly _input?: ElementRef<HTMLInputElement>;

    ngAfterViewInit(): void {
        queueMicrotask(() => this._input?.nativeElement.focus());
    }

    readonly search = signal('');
    readonly system = this._systems.system;
    readonly locating_id = signal<string | null>(null);
    readonly locate_error = signal<string | null>(null);

    readonly search_length = computed(() => this.search().trim().length);

    private readonly _state$ = combineLatest([
        toObservable(this.search).pipe(
            map((v) => v.trim()),
            debounceTime(250),
            distinctUntilChanged(),
        ),
        toObservable(this.system),
    ]).pipe(
        switchMap(([query, system]) => {
            if (!system || query.length < 2) return of(INITIAL_STATE);
            return executeOnSystem(system, 'list_users', 'Calendar', 1, [query]).pipe(
                map((result) => ({
                    users: this._normalise(result),
                    loading: false,
                    error: false,
                })),
                startWith({ ...INITIAL_STATE, loading: true }),
                catchError(() => of({ users: [], loading: false, error: true })),
            );
        }),
    );

    readonly state = toSignal(this._state$, { initialValue: INITIAL_STATE });

    readonly users = computed(() =>
        this.state().users.filter((u) => !!(u.office_location ?? '').toString().trim()),
    );

    onSearch(value: string): void {
        this.search.set(value);
    }

    onSelect(user: DirectoryUser, key: string): void {
        if (this.locating_id()) return;
        const system = this.system();
        if (!system) {
            this.locate_error.set('No system configured.');
            return;
        }
        this.locating_id.set(key);
        this.locate_error.set(null);
        this._locate.locate(system, user).subscribe({
            next: ({ lat, lng }) => {
                this.locating_id.set(null);
                this._router.navigate(this._wayfindingCommands(), {
                    queryParams: { lat, lng },
                    queryParamsHandling: 'merge',
                });
            },
            error: (err: unknown) => {
                this.locating_id.set(null);
                if (err instanceof LocationNotFoundError) {
                    this.locate_error.set(
                        `No map location could be found for ${user.name || user.email || 'this user'}.`,
                    );
                    return;
                }
                const message = err instanceof Error ? err.message : 'Unable to locate user.';
                this.locate_error.set(message);
            },
        });
    }

    private _wayfindingCommands(): unknown[] {
        const sys = this.system();
        return sys ? ['/', sys, 'wayfinding'] : ['/wayfinding'];
    }

    trackUser(index: number, user: DirectoryUser): string {
        return (user.id ?? user.email ?? user.name ?? String(index)).toString();
    }

    initials(user: DirectoryUser): string {
        const source = (user.name || user.email || '').toString().trim();
        if (!source) return '?';
        const parts = source.split(/[\s@._-]+/).filter(Boolean);
        const first = parts[0]?.[0] ?? '';
        const second = parts[1]?.[0] ?? '';
        return (first + second).toUpperCase() || source[0].toUpperCase();
    }

    private _normalise(result: unknown): DirectoryUser[] {
        if (Array.isArray(result)) return result as DirectoryUser[];
        if (result && typeof result === 'object') {
            const maybe = result as Record<string, unknown>;
            for (const key of ['users', 'results', 'value', 'data']) {
                if (Array.isArray(maybe[key])) return maybe[key] as DirectoryUser[];
            }
        }
        return [];
    }
}
