import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { SafePipe } from '../app/components/safe.pipe';

describe('SafePipe', () => {
    let pipe: SafePipe;
    let sanitizer: DomSanitizer;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [SafePipe] });
        sanitizer = TestBed.inject(DomSanitizer);
        pipe = TestBed.inject(SafePipe);
    });

    it('defaults to html sanitization', () => {
        const spy = vi.spyOn(sanitizer, 'bypassSecurityTrustHtml');
        pipe.transform('<b>x</b>');
        expect(spy).toHaveBeenCalledWith('<b>x</b>');
    });

    it('bypasses resource url when type is resource', () => {
        const spy = vi.spyOn(sanitizer, 'bypassSecurityTrustResourceUrl');
        pipe.transform('https://example.com/x.png', 'resource');
        expect(spy).toHaveBeenCalledWith('https://example.com/x.png');
    });

    it('bypasses url when type is url', () => {
        const spy = vi.spyOn(sanitizer, 'bypassSecurityTrustUrl');
        pipe.transform('tel:123', 'url');
        expect(spy).toHaveBeenCalledWith('tel:123');
    });

    it('bypasses script when type is script', () => {
        const spy = vi.spyOn(sanitizer, 'bypassSecurityTrustScript');
        pipe.transform('alert(1)', 'script');
        expect(spy).toHaveBeenCalledWith('alert(1)');
    });

    it('bypasses style when type is style', () => {
        const spy = vi.spyOn(sanitizer, 'bypassSecurityTrustStyle');
        pipe.transform('color:red', 'style');
        expect(spy).toHaveBeenCalledWith('color:red');
    });
});
