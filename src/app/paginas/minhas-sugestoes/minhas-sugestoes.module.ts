import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaMinhasSugestoesComponent } from './pagina-minhas-sugestoes.component';

@NgModule({
  declarations: [PaginaMinhasSugestoesComponent],
  imports: [CommonModule, CompartilhadoModule, RouterModule.forChild([{ path: '', component: PaginaMinhasSugestoesComponent }])],
})
export class MinhasSugestoesModule {}
