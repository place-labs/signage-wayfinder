import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { IconComponent } from './components/icon.component';
import { SettingsService } from './services/settings.service';
import { SystemService } from './services/system.service';

@Component({
    selector: 'signage-player',
    template: `
        @if (system()) {
            <iframe
                #frame
                [src]="safe_url()"
                [class.signage-player--hidden]="hide()"
                class="h-full w-full border-0"
                allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                referrerpolicy="no-referrer"
                title="PlaceOS Signage"
            ></iframe>
        } @else {
            <div
                class="flex h-full w-full flex-col items-center justify-center gap-4 p-8 opacity-30"
            >
                <icon class="text-8xl">desktop_access_disabled</icon>
                <p>Signage is not configured for this display.</p>
            </div>
        }
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            iframe.signage-player--hidden {
                visibility: hidden;
            }
        `,
    ],
    imports: [IconComponent],
})
export class SignagePlayer {
    private readonly _sanitizer = inject(DomSanitizer);
    private readonly _settings = inject(SettingsService);
    private readonly _systems = inject(SystemService);

    readonly hide = input<boolean>(false);

    readonly signage_url = this._settings.signal<string>('signage_url', '/signage');

    private readonly _frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

    public readonly system = this._systems.system;

    readonly embed_url = computed<string>(() => {
        const base = (this.signage_url() || '/signage').replace(/\/$/, '');
        const system = this.system();
        return system ? `${base}/#/signage/${encodeURIComponent(system)}` : `${base}/#/signage`;
    });

    readonly safe_url = computed<SafeResourceUrl>(() =>
        this._sanitizer.bypassSecurityTrustResourceUrl(this.embed_url()),
    );

    constructor() {
        effect(() => {
            const frame = this._frame()?.nativeElement;
            const window = frame?.contentWindow;
            if (!window) return;
            const hidden = this.hide();
            window.postMessage({ type: hidden ? 'signage:pause' : 'signage:resume' }, '*');
        });
    }
}
