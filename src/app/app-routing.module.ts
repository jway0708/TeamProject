import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { memberGuard } from './services/member-session';

const routes: Routes = [
  {
    path: 'home',
    redirectTo: 'login-page',
    pathMatch: 'full'
  },
  {
    path: '',
    redirectTo: 'tabs/homepage',
    pathMatch: 'full'
  },
  {
    path: 'login-page',
    loadChildren: () => import('./login-page/login-page.module').then( m => m.LoginPagePageModule)
  },
  {
    path: 'register-page',
    loadChildren: () => import('./register-page/register-page.module').then( m => m.RegisterPagePageModule)
  },
  {
    path: 'homepage',
    redirectTo: 'tabs/homepage',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then( m => m.TabsPageModule)
  },
  { path: 'member-qr', canActivate: [memberGuard], loadComponent: () => import('./member/member.page').then(m => m.MemberPage), data: { area: 'qr' } },
  { path: 'forgot-password', loadComponent: () => import('./account/reset.page').then(m => m.ResetPage) },
  { path: '**', redirectTo: 'tabs/homepage' },


];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
