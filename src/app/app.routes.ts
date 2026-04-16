import { Routes } from '@angular/router';

import { DirectoryPage } from './pages/directory.page';
import { WayfindingPage } from './pages/wayfinding.page';

export const routes: Routes = [
    { path: 'directory', component: DirectoryPage },
    { path: 'wayfinding', component: WayfindingPage },
];
