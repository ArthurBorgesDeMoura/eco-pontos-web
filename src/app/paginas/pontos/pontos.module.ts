import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaPontosComponent } from './pagina-pontos.component';

@NgModule({
  declarations: [PaginaPontosComponent],
  imports: [CommonModule, FormsModule, RouterModule, CompartilhadoModule],
  exports: [PaginaPontosComponent],
})
export class PontosModule {}
