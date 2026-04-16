import { Pipe, PipeTransform, inject } from '@angular/core';
import {
    DomSanitizer,
    SafeHtml,
    SafeResourceUrl,
    SafeScript,
    SafeStyle,
} from '@angular/platform-browser';

@Pipe({ name: 'safe' })
export class SafePipe implements PipeTransform {
    private sanitizer = inject(DomSanitizer);

    public transform(
        value: string,
        type: 'resource' | 'url' | 'script' | 'style' | 'html' = 'html',
    ): SafeHtml | SafeResourceUrl | SafeScript | SafeStyle {
        switch (type) {
            case 'resource':
                return this.sanitizer.bypassSecurityTrustResourceUrl(value);
            case 'url':
                return this.sanitizer.bypassSecurityTrustUrl(value);
            case 'script':
                return this.sanitizer.bypassSecurityTrustScript(value);
            case 'style':
                return this.sanitizer.bypassSecurityTrustStyle(value);
            default:
                return this.sanitizer.bypassSecurityTrustHtml(value);
        }
    }
}
