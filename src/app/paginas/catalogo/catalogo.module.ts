import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { PaginaCatalogoComponent } from './pagina-catalogo.component';

@NgModule({
  declarations: [PaginaCatalogoComponent],
  imports: [
    CommonModule,
    CompartilhadoModule,
    FormsModule,
    RouterModule.forChild([{ path: '', component: PaginaCatalogoComponent, title: 'Catálogo · EcoPonto' }]),
  ],
})
export class CatalogoModule {}
