import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import { IconComponent } from './components/icon.component';
import { SettingsService } from './services/settings.service';

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
            <icon class="text-6xl">desktop_access_disabled</icon>
            <p>Signage is not configured for this display.</p>
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
    private readonly _route = inject(ActivatedRoute);
    private readonly _sanitizer = inject(DomSanitizer);
    private readonly _settings = inject(SettingsService);

    readonly hide = input<boolean>(false);

    readonly signage_url = this._settings.signal<string>('signage_url', '/signage');

    private readonly _frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

    public readonly system = toSignal(
        this._route.queryParamMap.pipe(
            map((params) => params.get('system') || params.get('system_id')),
        ),
        { initialValue: null as string | null },
    );

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
