import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaNaoEncontradaComponent } from './pagina-nao-encontrada.component';
import { PaginaSemPermissaoComponent } from './pagina-sem-permissao.component';

@NgModule({
  declarations: [PaginaSemPermissaoComponent, PaginaNaoEncontradaComponent],
  imports: [CommonModule, RouterModule, CompartilhadoModule],
  exports: [PaginaSemPermissaoComponent, PaginaNaoEncontradaComponent],
})
export class SituacaoModule {}
