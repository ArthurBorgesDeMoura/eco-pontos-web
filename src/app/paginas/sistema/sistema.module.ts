import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaSistemaComponent } from './pagina-sistema.component';

@NgModule({
  declarations: [PaginaSistemaComponent],
  imports: [
    CommonModule,
    CompartilhadoModule,
    RouterModule.forChild([{ path: '', component: PaginaSistemaComponent, title: 'Sistema · EcoPonto' }]),
  ],
})
export class SistemaModule {}
