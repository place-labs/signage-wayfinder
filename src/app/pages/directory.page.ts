import { Component } from '@angular/core';

@Component({
    selector: 'directory-page',
    template: `
        <div
            class="flex h-full w-full items-center justify-center bg-[var(--mat-sys-surface)] text-[var(--mat-sys-on-surface)]"
        >
            <h1 class="text-3xl font-semibold">Directory</h1>
        </div>
    `,
})
export class DirectoryPage {}
