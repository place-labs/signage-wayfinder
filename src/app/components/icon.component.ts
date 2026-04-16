import { Component, computed, input } from '@angular/core';

import { SafePipe } from './safe.pipe';

export interface ApplicationIcon {
    /** Type of icon */
    type?: 'img' | 'icon';
    /** URL to the image used for the icon */
    src?: string;
    /** CSS class or variant key to apply to the icon element */
    class?: string;
    /** Contents of the icon element (e.g. ligature name) */
    content?: string;
    /** Background color */
    background?: string;
}

const CLASS_MAP: Record<string, string> = {
    rounded: 'material-symbols-rounded',
    outlined: 'material-symbols-outlined',
    sharp: 'material-symbols-sharp',
};

@Component({
    selector: 'icon,i[icon]',
    template: `
        <div
            class="flex h-[1.25em] max-h-[1.25em] w-[1.25em] max-w-[1.25em] items-center justify-center overflow-hidden"
        >
            @if (!icon() || icon()?.type !== 'img') {
                <i [class]="class_ref()">
                    {{ icon()?.content }}
                    <ng-content></ng-content>
                </i>
            }
            @if (icon()?.type === 'img' && icon()?.src) {
                <img
                    class="h-[1em] w-[1em]"
                    [src]="icon()!.src! | safe: 'resource'"
                    alt=""
                />
            }
        </div>
    `,
    styles: [
        `
            i {
                font-size: 1em;
            }
        `,
    ],
    imports: [SafePipe],
})
export class IconComponent {
    public readonly className = input('material-symbols-rounded');
    public readonly icon = input<ApplicationIcon | undefined>(undefined);

    public readonly class_ref = computed(
        () =>
            CLASS_MAP[this.icon()?.class ?? ''] ||
            CLASS_MAP[this.className()] ||
            this.className(),
    );
}
