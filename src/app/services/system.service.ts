import { Injectable, inject, signal } from '@angular/core';
import {
    ActivatedRoute,
    ActivatedRouteSnapshot,
    NavigationEnd,
    Router,
} from '@angular/router';
import { filter, startWith } from 'rxjs/operators';

const KEYS = ['system', 'system_id'] as const;

@Injectable({ providedIn: 'root' })
export class SystemService {
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _system = signal<string | null>(null);

    readonly system = this._system.asReadonly();

    init(): void {
        this._router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                startWith(null),
            )
            .subscribe(() => {
                const id = this._extract();
                if (id) this._system.set(id);
            });
    }

    private _extract(): string | null {
        let snapshot: ActivatedRouteSnapshot | null = this._route.snapshot;
        while (snapshot) {
            for (const key of KEYS) {
                const value =
                    snapshot.paramMap.get(key) ?? snapshot.queryParamMap.get(key);
                if (value) return value;
            }
            snapshot = snapshot.firstChild;
        }
        return null;
    }
}
