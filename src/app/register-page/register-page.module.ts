import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { RegisterPagePageRoutingModule } from './register-page-routing.module';

import { RegisterPagePage } from './register-page.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RegisterPagePageRoutingModule
  ],
  declarations: [RegisterPagePage]
})
export class RegisterPagePageModule {}
