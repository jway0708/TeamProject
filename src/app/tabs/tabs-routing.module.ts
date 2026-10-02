import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabsPage } from './tabs.page';
import { memberGuard } from '../services/member-session';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'homepage',
        loadChildren: () =>
          import('../homepage/homepage.module').then(m => m.HomepagePageModule)
      },
      ...['rewards', 'vouchers', 'stamps', 'history', 'notifications', 'stores', 'refer', 'wallet', 'profile', 'feedback', 'qr', 'highlight'].map(area => ({
        path: area,
        canActivate: [memberGuard],
        loadComponent: () => import('../member/member.page').then(m => m.MemberPage),
        data: { area },
      })),
      {
        path: '',
        redirectTo: 'homepage',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
