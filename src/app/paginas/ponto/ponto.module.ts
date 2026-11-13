import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaPontoComponent } from './pagina-ponto.component';

@NgModule({
  declarations: [PaginaPontoComponent],
  imports: [CommonModule, RouterModule, CompartilhadoModule],
  exports: [PaginaPontoComponent],
})
export class PontoModule {}
