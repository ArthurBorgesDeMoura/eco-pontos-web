import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { FormularioDoPontoModule } from '../formulario-ponto/formulario-ponto.module';
import { PaginaSugerirComponent } from './pagina-sugerir.component';

@NgModule({
  declarations: [PaginaSugerirComponent],
  imports: [CommonModule, FormularioDoPontoModule, RouterModule.forChild([{ path: '', component: PaginaSugerirComponent }])],
})
export class SugerirModule {}
