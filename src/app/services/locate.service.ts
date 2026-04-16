import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { executeOnSystem } from '@placeos/ts-client';
import { Observable, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SettingsService } from './settings.service';

export interface DirectoryUser {
    id?: string;
    name?: string;
    email?: string;
    office_location?: string;
    department?: string;
    phone?: string;
    photo?: string;
    [key: string]: unknown;
}

export interface LocateResult {
    lat: number;
    lng: number;
    query: string;
    address?: string;
}

interface PlacesSearchResponse {
    places?: Array<{
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
    }>;
}

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const NOT_FOUND_PATTERNS = [
    /\bnot[_\s-]?found\b/i,
    /\bno (?:real[- ]?world )?(?:location|address|match)\b/i,
    /\b(?:unable|cannot|can['’]?t|unknown|no information)\b.*\b(?:locat|identif|find|determin)/i,
    /\bi (?:do not|don['’]?t) (?:know|have)\b/i,
];

export class LocationNotFoundError extends Error {
    constructor(public readonly office_location: string) {
        super(`No real-world location found for "${office_location}"`);
        this.name = 'LocationNotFoundError';
    }
}

function isNotFound(text: string): boolean {
    const stripped = text.replace(/[`"'*_.\s]+/g, ' ').trim();
    if (!stripped) return true;
    return NOT_FOUND_PATTERNS.some((re) => re.test(stripped));
}

function extractText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.map(extractText).filter(Boolean).join(' ').trim();
    }
    if (typeof value === 'object') {
        const v = value as Record<string, unknown>;
        for (const key of ['text', 'content', 'message', 'output', 'response', 'result']) {
            if (v[key] != null) {
                const inner = extractText(v[key]);
                if (inner) return inner;
            }
        }
    }
    return '';
}

@Injectable({ providedIn: 'root' })
export class LocateService {
    private readonly _http = inject(HttpClient);
    private readonly _settings = inject(SettingsService);

    locate(system: string, user: DirectoryUser): Observable<LocateResult> {
        const office = (user.office_location ?? '').toString().trim();
        if (!office) return throwError(() => new LocationNotFoundError('(no office location)'));

        const base_prompt = (this._settings.get<string>('app.llm_prompt') ?? '').toString();
        const prefix = (this._settings.get<string>('app.llm_prefix') ?? '').toString();
        const places_key = (this._settings.get<string>('app.places_api_key') ?? '').toString().trim();
        if (!places_key) return throwError(() => new Error('places_api_key is not configured'));

        const prompt = `${base_prompt}${office}`;

        return executeOnSystem(system, 'generate', 'LLM', 1, [
            prompt,
            [{ type: 'web_search' }],
        ]).pipe(
            map((result) => {
                const text = extractText(result).trim();
                if (!text) throw new LocationNotFoundError(office);
                if (isNotFound(text)) throw new LocationNotFoundError(office);
                const needs_prefix = prefix && !text.toLowerCase().includes(prefix.toLowerCase());
                return needs_prefix ? `${prefix} ${text}`.trim() : text;
            }),
            switchMap((query) => this._searchPlaces(query, places_key)),
        );
    }

    private _searchPlaces(query: string, api_key: string): Observable<LocateResult> {
        return this._http
            .post<PlacesSearchResponse>(
                PLACES_ENDPOINT,
                { textQuery: query },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': api_key,
                        'X-Goog-FieldMask': 'places.formattedAddress,places.location',
                    },
                },
            )
            .pipe(
                map((response) => {
                    const place = response.places?.[0];
                    const lat = place?.location?.latitude;
                    const lng = place?.location?.longitude;
                    if (typeof lat !== 'number' || typeof lng !== 'number') {
                        throw new Error(`No Places match for "${query}"`);
                    }
                    return { lat, lng, query, address: place?.formattedAddress };
                }),
            );
    }
}
