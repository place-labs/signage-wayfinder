import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import {
    Component,
    Directive,
    ElementRef,
    OnDestroy,
    effect,
    inject,
    model,
    signal,
} from '@angular/core';
import { MatRippleModule } from '@angular/material/core';

const DEFAULT_KEYS = [
    '0123456789'.split(''),
    'qwertyuiop'.split(''),
    'asdfghjkl'.split(''),
    'zxcvbnm'.split(''),
    ['{caps}', '{space}', '{backspace}'],
];

@Component({
    selector: 'virtual-keyboard',
    template: `
        <div
            keyboard-view
            class="flex w-screen flex-col space-y-4 border-t border-gray-300 bg-gray-50 p-2"
        >
            @for (row of keyset(); track row[0]) {
                <div row class="flex items-center justify-center space-x-2">
                    @for (key of row; track key) {
                        <button
                            matRipple
                            [attr.key]="key"
                            tabindex="0"
                            class="relative cursor-pointer rounded-xl border border-gray-300 bg-gray-50 p-2"
                            [class.special]="key[0] === '{' && key.length > 1"
                            [class.space]="key === '{space}'"
                            (focus)="focusInput()"
                            (click)="handleKeyPress(key)"
                        >
                            {{
                                key === '{space}'
                                    ? 'Space'
                                    : key === '{caps}'
                                      ? 'Caps Lock'
                                      : key === '{backspace}'
                                        ? 'Backspace'
                                        : key
                            }}
                            @if (key === '{caps}') {
                                <div
                                    dot
                                    class="bg-base-200 absolute top-2 right-2 h-2 w-2 rounded-full"
                                    [class.bg-success]="state() === 'shift'"
                                ></div>
                            }
                        </button>
                    }
                </div>
            }
        </div>
    `,
    styles: [
        `
            [key] {
                height: 3.5rem;
                width: 4rem;
                transition:
                    box-shadow 200ms,
                    top 200ms;
                box-shadow: 0 4px 0 0.04px rgba(0, 0, 0, 0.1);
            }

            [keyboard-view] {
                animation: keyboard-fade-in 180ms ease-out both;
            }

            @keyframes keyboard-fade-in {
                from {
                    opacity: 0;
                }

                to {
                    opacity: 1;
                }
            }

            [key].special {
                width: 10rem;
            }

            [key].space {
                flex: 1;
                min-width: 10rem;
                max-width: 25rem;
            }

            [key]:hover {
                top: 2px;
                box-shadow: 0 2px 0 0.04px rgba(0, 0, 0, 0.1);
            }

            [key]:active {
                top: 4px;
                box-shadow: 0 0 0 0.04px rgba(0, 0, 0, 0.1);
            }
        `,
    ],
    imports: [MatRippleModule],
})
export class VirtualKeyboardComponent {
    public target: HTMLInputElement | HTMLTextAreaElement | null = null;
    public refocus: () => void = () => undefined;

    /** Whether virtual keyboard should activate */
    public static enabled: boolean;

    /** List of rows of keys to display on the keyboard */
    public readonly keyset = model(DEFAULT_KEYS);
    /** Current state of the displayed keyset */
    public readonly state = signal<'normal' | 'caps' | 'shift'>('normal');

    constructor() {
        effect(() => {
            const keys = this.keyset();
            if (!keys) this.keyset.set(DEFAULT_KEYS);
        });
    }

    public focusInput() {
        this.refocus();
    }

    public handleKeyPress(key: string) {
        const target = this.target;
        if (!target) return;
        const str = target.value || '';
        let cursor_pos = target.selectionStart ?? str.length;
        switch (key.toLowerCase()) {
            case '{caps}':
            case '{shift}':
                this.state.set('shift');
                break;
            case '{backspace}':
                target.value = `${str.substr(0, cursor_pos - 1)}${str.substr(cursor_pos, str.length)}`;
                cursor_pos = Math.max(0, cursor_pos - 1);
                break;
            case '{space}':
                target.value = `${str.substr(0, cursor_pos)}${' '}${str.substr(cursor_pos, str.length)}`;
                cursor_pos += 1;
                break;
            default:
                if (this.state() === 'shift') this.state.set('normal');
                target.value = `${str.substr(0, cursor_pos)}${key}${str.substr(cursor_pos, str.length)}`;
                cursor_pos += 1;
        }
        target.dispatchEvent(new InputEvent('input', { bubbles: true }));
        this.updateKeyState();
        setTimeout(() => {
            this.focusInput();
            target.selectionStart = cursor_pos;
            target.selectionEnd = cursor_pos;
        }, 50);
    }

    public updateKeyState() {
        this.keyset.set(
            this.keyset().map((_) =>
                _.map((k) =>
                    k.length > 1
                        ? k
                        : k[this.state() !== 'normal' ? 'toUpperCase' : 'toLowerCase'](),
                ),
            ),
        );
    }
}

@Directive({
    selector: 'input[keyboard],textarea[keyboard]',
    host: {
        '(focus)': 'onFocus()',
        '(blur)': 'onBlur()',
    },
})
export class VirtualKeyboardDirective implements OnDestroy {
    private _element = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
    private _overlay = inject(Overlay);
    private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();

    /** References to the overlay containing the keyboard */
    private _overlay_ref: OverlayRef | null = null;

    public onFocus() {
        if (!VirtualKeyboardComponent.enabled) return;
        this.open();
        this.clearTimeout('blur-sm');
    }

    public onBlur() {
        this.timeout('blur-sm', () => this.close());
    }

    public ngOnDestroy() {
        for (const timer of this._timers.values()) clearTimeout(timer);
        this._timers.clear();
        this.close();
    }

    public focusInput() {
        this._element?.nativeElement?.blur();
        this._element?.nativeElement?.focus();
    }

    public open() {
        if (this._overlay_ref) return;
        this._overlay_ref = this._overlay.create({
            positionStrategy: this._overlay.position().global().bottom().centerHorizontally(),
        });
        const ref = this._overlay_ref.attach(new ComponentPortal(VirtualKeyboardComponent));
        ref.instance.target = this._element.nativeElement;
        ref.instance.refocus = () => this.focusInput();
    }

    public close() {
        if (this._overlay_ref) {
            this._overlay_ref.dispose();
            this._overlay_ref = null;
        }
    }

    private timeout(name: string, fn: () => void, delay = 300): void {
        this.clearTimeout(name);
        this._timers.set(
            name,
            setTimeout(() => {
                this._timers.delete(name);
                fn();
            }, delay),
        );
    }

    private clearTimeout(name: string): void {
        const timer = this._timers.get(name);
        if (!timer) return;
        clearTimeout(timer);
        this._timers.delete(name);
    }
}
