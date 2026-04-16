import { Routes } from '@angular/router';

import { DirectoryPage } from './pages/directory.page';
import { SignagePage } from './pages/signage.page';
import { WayfindingPage } from './pages/wayfinding.page';

export const routes: Routes = [
    { path: '', component: SignagePage, pathMatch: 'full' },
    { path: 'directory', component: DirectoryPage },
    { path: 'wayfinding', component: WayfindingPage },
    { path: ':system/directory', component: DirectoryPage },
    { path: ':system/wayfinding', component: WayfindingPage },
    { path: ':system', component: SignagePage, pathMatch: 'full' },
];
