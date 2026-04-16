import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { IdleService } from '../app/services/idle.service';
import { SettingsService } from '../app/services/settings.service';

describe('IdleService', () => {
    let timeoutSignal: WritableSignal<number>;
    let router: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };
    let settings: { signal: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.useFakeTimers();
        timeoutSignal = signal(60);
        router = { url: '/directory', navigateByUrl: vi.fn() };
        settings = {
            signal: vi.fn(() => timeoutSignal),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: router },
                { provide: SettingsService, useValue: settings },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('navigates home after timeout elapses', () => {
        const service = TestBed.inject(IdleService);
        service.start();
        vi.advanceTimersByTime(60 * 1000);
        expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('does not navigate when already on root route', () => {
        router.url = '/';
        const service = TestBed.inject(IdleService);
        service.start();
        vi.advanceTimersByTime(120 * 1000);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('resets timeout when user activity fires', () => {
        const service = TestBed.inject(IdleService);
        service.start();
        vi.advanceTimersByTime(55 * 1000);
        document.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(55 * 1000);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        vi.advanceTimersByTime(10 * 1000);
        expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('stop() halts scheduled navigation', () => {
        const service = TestBed.inject(IdleService);
        service.start();
        service.stop();
        vi.advanceTimersByTime(60 * 1000);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('start() is idempotent', () => {
        const service = TestBed.inject(IdleService);
        const addSpy = vi.spyOn(document, 'addEventListener');
        service.start();
        service.start();
        const firstCallCount = addSpy.mock.calls.filter(
            (c) => c[0] === 'pointerdown',
        ).length;
        expect(firstCallCount).toBe(1);
    });
});
