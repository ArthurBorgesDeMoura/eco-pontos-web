import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaCriarContaComponent } from './pagina-criar-conta.component';
import { PaginaEntrarComponent } from './pagina-entrar.component';

@NgModule({
  declarations: [PaginaEntrarComponent, PaginaCriarContaComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CompartilhadoModule],
  exports: [PaginaEntrarComponent, PaginaCriarContaComponent],
})
export class AcessoModule {}
