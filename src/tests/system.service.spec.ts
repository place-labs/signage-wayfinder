import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { EMPTY } from 'rxjs';

import { SystemService } from '../app/services/system.service';

function makeSnapshot(params: Record<string, string>, query: Record<string, string> = {}, child: unknown = null) {
    return {
        paramMap: convertToParamMap(params),
        queryParamMap: convertToParamMap(query),
        firstChild: child,
    };
}

describe('SystemService', () => {
    function setup(snapshot: unknown) {
        TestBed.configureTestingModule({
            providers: [
                { provide: ActivatedRoute, useValue: { snapshot } },
                { provide: Router, useValue: { events: EMPTY } },
            ],
        });
        return TestBed.inject(SystemService);
    }

    it('starts with null system', () => {
        const service = setup(makeSnapshot({}));
        expect(service.system()).toBeNull();
    });

    it('extracts system from route paramMap on init', () => {
        const service = setup(makeSnapshot({ system: 'sys-abc' }));
        service.init();
        expect(service.system()).toBe('sys-abc');
    });

    it('extracts system_id from queryParamMap on init', () => {
        const service = setup(makeSnapshot({}, { system_id: 'qsys-42' }));
        service.init();
        expect(service.system()).toBe('qsys-42');
    });

    it('walks child routes to find the system param', () => {
        const child = makeSnapshot({ system: 'deep-sys' });
        const snapshot = makeSnapshot({}, {}, child);
        const service = setup(snapshot);
        service.init();
        expect(service.system()).toBe('deep-sys');
    });

    it('keeps previous system when no id is present after navigation', () => {
        const child = makeSnapshot({ system: 'first' });
        const snapshot = { ...makeSnapshot({}), firstChild: child as unknown as null };
        const service = setup(snapshot);
        service.init();
        expect(service.system()).toBe('first');
    });
});
