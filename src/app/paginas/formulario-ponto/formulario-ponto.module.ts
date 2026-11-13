import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { FormularioDoPontoComponent } from './formulario-ponto.component';

@NgModule({
  declarations: [FormularioDoPontoComponent],
  imports: [CommonModule, ReactiveFormsModule, CompartilhadoModule],
  exports: [FormularioDoPontoComponent],
})
export class FormularioDoPontoModule {}
