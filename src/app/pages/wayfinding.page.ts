import { Component } from '@angular/core';

@Component({
    selector: 'wayfinding-page',
    template: `
        <div class="h-full w-full bg-gray-300">
            <iframe
                width="100%"
                height="500"
                style="border:0"
                loading="lazy"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY
        &origin=-33.8708,151.2073
        &destination=-33.8731,151.2060
        &mode=walking"
            >
            </iframe>
        </div>
    `,
})
export class WayfindingPage {}
