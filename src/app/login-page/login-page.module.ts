import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { LoginPagePageRoutingModule } from './login-page-routing.module';

import { LoginPage } from './login-page.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LoginPagePageRoutingModule
  ],
  declarations: [LoginPage]
})
export class LoginPagePageModule {}
