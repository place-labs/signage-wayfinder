import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SystemService {
    private readonly _route = inject(ActivatedRoute);
    private readonly _system = signal<string | null>(null);

    readonly system = this._system.asReadonly();

    init(): void {
        this._route.queryParamMap.subscribe((params) => {
            const id = params.get('system') || params.get('system_id');
            if (id) this._system.set(id);
        });
    }
}
