import { TestBed } from '@angular/core/testing';

import { IconComponent } from '../app/components/icon.component';

describe('IconComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [IconComponent] }).compileComponents();
    });

    it('defaults class_ref to rounded material symbols class', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.class_ref()).toBe('material-symbols-rounded');
    });

    it('maps icon.class variant keys to CSS classes', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.componentRef.setInput('icon', { class: 'outlined', content: 'home' });
        fixture.detectChanges();
        expect(fixture.componentInstance.class_ref()).toBe('material-symbols-outlined');
    });

    it('maps className variant keys to CSS classes', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.componentRef.setInput('className', 'sharp');
        fixture.detectChanges();
        expect(fixture.componentInstance.class_ref()).toBe('material-symbols-sharp');
    });

    it('falls back to raw className when not a known variant', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.componentRef.setInput('className', 'custom-icon-class');
        fixture.detectChanges();
        expect(fixture.componentInstance.class_ref()).toBe('custom-icon-class');
    });

    it('renders icon content as text when no img', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.componentRef.setInput('icon', { content: 'home' });
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('i')?.textContent?.trim()).toBe('home');
        expect(el.querySelector('img')).toBeNull();
    });

    it('renders an image when icon.type is img and src is set', () => {
        const fixture = TestBed.createComponent(IconComponent);
        fixture.componentRef.setInput('icon', { type: 'img', src: '/assets/ic.png' });
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('img')).not.toBeNull();
    });
});
