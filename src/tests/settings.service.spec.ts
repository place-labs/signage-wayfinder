import { TestBed } from '@angular/core/testing';

vi.mock('@placeos/ts-client', async () => {
    const { of } = await import('rxjs');
    return {
        authority: vi.fn(() => ({ config: { org_zone: 'zone-primary' } })),
        isMock: vi.fn(() => false),
        queryZones: vi.fn(() =>
            of({ data: [{ id: 'zone-primary' }, { id: 'zone-other' }] }),
        ),
        showMetadata: vi.fn(() =>
            of({ details: { places_api_key: 'METADATA_KEY', custom_value: 42 } }),
        ),
    };
});

import { SettingsService } from '../app/services/settings.service';

describe('SettingsService', () => {
    let service: SettingsService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(SettingsService);
    });

    it('returns default settings via get()', () => {
        expect(service.get<string>('app.name')).toBe('Signage Wayfinder');
        expect(service.get<number>('app.idle_timeout_secs')).toBe(60);
        expect(service.get<string>('composer.route')).toBe('/signage-wayfinder');
    });

    it('returns undefined for unknown keys', () => {
        expect(service.get('app.nonexistent')).toBeUndefined();
        expect(service.get('does.not.exist')).toBeUndefined();
    });

    it('signal() returns default_value when key unset', () => {
        const s = service.signal<number>('my_timeout', 99);
        expect(s()).toBe(99);
    });

    it('signal() is cached per key', () => {
        const a = service.signal<number>('cached_key', 1);
        const b = service.signal<number>('cached_key', 999);
        expect(a).toBe(b);
    });

    it('init() loads metadata overrides and refreshes signals', async () => {
        const api_key_signal = service.signal<string>('places_api_key', '');
        expect(api_key_signal()).toBe('');

        await service.init();

        expect(service.get<string>('app.places_api_key')).toBe('METADATA_KEY');
        expect(service.get<number>('app.custom_value')).toBe(42);
        expect(api_key_signal()).toBe('METADATA_KEY');
    });

    it('init() falls through to defaults when override missing', async () => {
        await service.init();
        expect(service.get<string>('app.name')).toBe('Signage Wayfinder');
    });

    it('reload() refreshes existing signals from new metadata', async () => {
        const signalRef = service.signal<string>('places_api_key', '');
        await service.init();
        expect(signalRef()).toBe('METADATA_KEY');

        const { showMetadata } = await import('@placeos/ts-client');
        const { of } = await import('rxjs');
        (showMetadata as unknown as import('vitest').Mock).mockReturnValueOnce(
            of({ details: { places_api_key: 'NEW_KEY' } }),
        );

        await service.reload();
        expect(signalRef()).toBe('NEW_KEY');
    });
});
