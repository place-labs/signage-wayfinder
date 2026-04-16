import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

vi.mock('@placeos/ts-client', async () => {
    const { of } = await import('rxjs');
    return {
        executeOnSystem: vi.fn(() => of('123 Main St, Anywhere')),
        authority: vi.fn(() => ({ config: {} })),
        isMock: vi.fn(() => false),
        queryZones: vi.fn(() => of({ data: [] })),
        showMetadata: vi.fn(() => of({ details: {} })),
    };
});

import { executeOnSystem } from '@placeos/ts-client';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import {
    LocateService,
    LocationNotFoundError,
} from '../app/services/locate.service';
import { SettingsService } from '../app/services/settings.service';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

async function expectError<T>(obs: Observable<T>): Promise<unknown> {
    try {
        await firstValueFrom(obs);
    } catch (err) {
        return err;
    }
    throw new Error('Expected observable to error, but it completed');
}

describe('LocateService', () => {
    let service: LocateService;
    let http: HttpTestingController;
    let settings_values: Record<string, unknown>;

    beforeEach(() => {
        settings_values = {
            'app.llm_prompt': 'Resolve: ',
            'app.llm_prefix': '',
            'app.places_api_key': 'TEST_KEY',
        };
        const settingsMock = {
            get: vi.fn((k: string) => settings_values[k]),
        };
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: SettingsService, useValue: settingsMock },
            ],
        });
        service = TestBed.inject(LocateService);
        http = TestBed.inject(HttpTestingController);
        (executeOnSystem as unknown as Mock).mockReturnValue(
            of('123 Main St, Anywhere'),
        );
    });

    afterEach(() => http.verify());

    describe('locate()', () => {
        it('errors when user has no office_location', async () => {
            const err = await expectError(service.locate('sys-1', { office_location: '' }));
            expect(err).toBeInstanceOf(LocationNotFoundError);
        });

        it('errors when places_api_key is missing', async () => {
            settings_values['app.places_api_key'] = '';
            const err = await expectError(
                service.locate('sys-1', { office_location: 'Bldg 4' }),
            );
            expect((err as Error).message).toMatch(/places_api_key/);
        });

        it('resolves to lat/lng/address on happy path', async () => {
            const promise = firstValueFrom(
                service.locate('sys-1', { office_location: 'Bldg 4' }),
            );
            const req = http.expectOne(PLACES_URL);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ textQuery: '123 Main St, Anywhere' });
            expect(req.request.headers.get('X-Goog-Api-Key')).toBe('TEST_KEY');
            req.flush({
                places: [
                    {
                        formattedAddress: '123 Main St, Anywhere, USA',
                        location: { latitude: 10, longitude: 20 },
                    },
                ],
            });
            await expect(promise).resolves.toEqual({
                lat: 10,
                lng: 20,
                query: '123 Main St, Anywhere',
                address: '123 Main St, Anywhere, USA',
            });
        });

        it('throws LocationNotFoundError for NOT_FOUND responses', async () => {
            (executeOnSystem as unknown as Mock).mockReturnValueOnce(of('NOT_FOUND'));
            const err = await expectError(
                service.locate('sys-1', { office_location: 'Unknown' }),
            );
            expect(err).toBeInstanceOf(LocationNotFoundError);
        });

        it('throws LocationNotFoundError for empty LLM text', async () => {
            (executeOnSystem as unknown as Mock).mockReturnValueOnce(of(''));
            const err = await expectError(
                service.locate('sys-1', { office_location: 'Empty' }),
            );
            expect(err).toBeInstanceOf(LocationNotFoundError);
        });

        it('applies llm_prefix when response lacks it', async () => {
            settings_values['app.llm_prefix'] = 'Campus';
            (executeOnSystem as unknown as Mock).mockReturnValueOnce(of('Royce Hall'));
            const promise = firstValueFrom(
                service.locate('sys-1', { office_location: 'RH' }),
            );
            const req = http.expectOne(PLACES_URL);
            expect(req.request.body).toEqual({ textQuery: 'Campus Royce Hall' });
            req.flush({ places: [{ location: { latitude: 1, longitude: 2 } }] });
            await promise;
        });

        it('errors when Places returns no match', async () => {
            const promise = firstValueFrom(service.locate('sys-1', { office_location: 'X' }));
            http.expectOne(PLACES_URL).flush({ places: [] });
            await expect(promise).rejects.toThrow(/No Places match/);
        });

        it('propagates non-match LLM phrases as LocationNotFoundError', async () => {
            (executeOnSystem as unknown as Mock).mockReturnValueOnce(
                of("I'm unable to identify a real-world location for this."),
            );
            const err = await expectError(
                service.locate('s', { office_location: 'Foo' }),
            );
            expect(err).toBeInstanceOf(LocationNotFoundError);
        });

        it('propagates LLM operational errors', async () => {
            (executeOnSystem as unknown as Mock).mockReturnValueOnce(
                throwError(() => new Error('network')),
            );
            const err = await expectError(
                service.locate('s', { office_location: 'Foo' }),
            );
            expect((err as Error).message).toBe('network');
        });
    });

    describe('autocomplete()', () => {
        it('returns empty array for blank input', async () => {
            const result = await firstValueFrom(service.autocomplete('   '));
            expect(result).toEqual([]);
        });

        it('errors when key is missing', async () => {
            settings_values['app.places_api_key'] = '';
            const err = await expectError(service.autocomplete('hello'));
            expect((err as Error).message).toMatch(/places_api_key/);
        });

        it('maps predictions to PlaceSuggestion list and sends bias', async () => {
            const promise = firstValueFrom(service.autocomplete('royce', '34.07,-118.44'));
            const req = http.expectOne(AUTOCOMPLETE_URL);
            expect(req.request.body).toEqual({
                input: 'royce',
                locationBias: {
                    circle: {
                        center: { latitude: 34.07, longitude: -118.44 },
                        radius: 50000,
                    },
                },
            });
            req.flush({
                suggestions: [
                    {
                        placePrediction: {
                            placeId: 'p1',
                            text: { text: 'Royce Hall, UCLA' },
                            structuredFormat: {
                                mainText: { text: 'Royce Hall' },
                                secondaryText: { text: 'UCLA' },
                            },
                        },
                    },
                ],
            });
            await expect(promise).resolves.toEqual([
                {
                    place_id: 'p1',
                    main_text: 'Royce Hall',
                    secondary_text: 'UCLA',
                    full_text: 'Royce Hall, UCLA',
                },
            ]);
        });

        it('skips predictions that are missing a placeId', async () => {
            const promise = firstValueFrom(service.autocomplete('x'));
            http.expectOne(AUTOCOMPLETE_URL).flush({
                suggestions: [{ placePrediction: { text: { text: 'No id' } } }],
            });
            await expect(promise).resolves.toEqual([]);
        });

        it('omits locationBias when lat/lng is invalid', async () => {
            const promise = firstValueFrom(service.autocomplete('x', 'not,coords'));
            const req = http.expectOne(AUTOCOMPLETE_URL);
            expect(req.request.body).toEqual({ input: 'x' });
            req.flush({ suggestions: [] });
            await promise;
        });
    });

    describe('lookupPlace()', () => {
        it('returns lat/lng/query/address on success', async () => {
            const promise = firstValueFrom(service.lookupPlace('p-42'));
            const req = http.expectOne(`${DETAILS_URL}/p-42`);
            expect(req.request.method).toBe('GET');
            expect(req.request.headers.get('X-Goog-Api-Key')).toBe('TEST_KEY');
            req.flush({
                id: 'p-42',
                formattedAddress: '10 Royce',
                displayName: { text: 'Royce Hall' },
                location: { latitude: 1, longitude: 2 },
            });
            await expect(promise).resolves.toEqual({
                lat: 1,
                lng: 2,
                query: 'Royce Hall',
                address: '10 Royce',
            });
        });

        it('errors when the place has no location', async () => {
            const promise = firstValueFrom(service.lookupPlace('p-none'));
            http.expectOne(`${DETAILS_URL}/p-none`).flush({
                id: 'p-none',
                formattedAddress: 'Somewhere',
            });
            await expect(promise).rejects.toThrow(/no location/i);
        });

        it('errors when key is missing', async () => {
            settings_values['app.places_api_key'] = '';
            const err = await expectError(service.lookupPlace('p1'));
            expect((err as Error).message).toMatch(/places_api_key/);
        });

        it('url-encodes the place id', async () => {
            const promise = firstValueFrom(service.lookupPlace('ChIJ/with slash'));
            const req = http.expectOne(
                `${DETAILS_URL}/${encodeURIComponent('ChIJ/with slash')}`,
            );
            req.flush({ location: { latitude: 1, longitude: 2 } });
            await promise;
        });
    });
});
