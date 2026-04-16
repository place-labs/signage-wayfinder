import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatRippleModule } from '@angular/material/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import { IconComponent } from './components/icon.component';
import { IdleService } from './services/idle.service';
import { PlaceOSService } from './services/placeos.service';
import { SystemService } from './services/system.service';
import { SignagePlayer } from './signage-player';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        SignagePlayer,
        IconComponent,
        MatRippleModule,
    ],
    template: `
        <div
            class="relative flex h-full w-full bg-[var(--mat-sys-surface)] portrait:flex-col landscape:flex-row"
        >
            <nav
                class="flex shrink-0 items-center justify-around gap-2 border-gray-300 bg-gray-50 p-2 portrait:h-22 portrait:w-full portrait:flex-row portrait:border-b landscape:h-full landscape:w-28 landscape:flex-col landscape:justify-start landscape:border-r"
            >
                <button
                    matRipple
                    [routerLink]="directory_link()"
                    routerLinkActive="bg-blue-500 text-white shadow"
                    class="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl p-1 landscape:w-full"
                    [attr.aria-current]="active_tab() === 'directory' ? 'page' : null"
                >
                    <icon class="text-4xl">list_alt</icon>
                    <span class="text-sm">Directory</span>
                </button>
                <button
                    matRipple
                    [routerLink]="wayfinding_link()"
                    routerLinkActive="bg-blue-500 text-white shadow"
                    class="flex flex-1 flex-col items-center justify-center rounded-xl p-1 landscape:w-full"
                    [attr.aria-current]="active_tab() === 'wayfinding' ? 'page' : null"
                >
                    <icon class="text-4xl">explore</icon>
                    <span class="text-sm">Wayfinding</span>
                </button>
            </nav>
            <main class="relative flex-1 overflow-hidden">
                <signage-player
                    [hide]="hide_signage()"
                    class="absolute inset-0 block bg-gray-200"
                />
                <div class="absolute inset-0 z-10">
                    <router-outlet />
                </div>
                @if (hide_signage()) {
                    <button
                        matRipple
                        routerLink="/"
                        class="absolute! top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-blue-600 bg-blue-500 text-white shadow-md"
                        aria-label="Back to signage"
                    >
                        <icon class="text-2xl">arrow_back</icon>
                    </button>
                }
            </main>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }
        `,
    ],
})
export class App implements OnInit {
    private readonly _placeos = inject(PlaceOSService);
    private readonly _router = inject(Router);
    private readonly _idle = inject(IdleService);
    private readonly _system = inject(SystemService);

    protected readonly title = signal('signage-wayfinder');
    protected readonly ready = this._placeos.ready;

    protected readonly active_tab = toSignal(
        this._router.events.pipe(
            filter((e): e is NavigationEnd => e instanceof NavigationEnd),
            map((e) => {
                const path = e.urlAfterRedirects.split('?')[0].replace(/^\//, '');
                const segments = path.split('/').filter(Boolean);
                return segments[segments.length - 1] ?? '';
            }),
            startWith(''),
        ),
        { initialValue: '' },
    );

    protected readonly hide_signage = computed(() =>
        ['directory', 'wayfinding'].includes(this.active_tab()),
    );

    protected readonly directory_link = computed(() => {
        const sys = this._system.system();
        return sys ? ['/', sys, 'directory'] : ['/directory'];
    });

    protected readonly wayfinding_link = computed(() => {
        const sys = this._system.system();
        return sys ? ['/', sys, 'wayfinding'] : ['/wayfinding'];
    });

    async ngOnInit(): Promise<void> {
        this._system.init();
        await this._placeos.init();
        this._idle.start();
    }
}
