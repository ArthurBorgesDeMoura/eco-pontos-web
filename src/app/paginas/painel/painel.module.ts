import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { DadosDaRota } from '../../dados-da-rota';
import { ROTA_DAS_CATEGORIAS_DO_PAINEL, ROTA_DOS_PONTOS_DO_PAINEL } from '../../rotas';
import { FormularioDoPontoModule } from '../formulario-ponto/formulario-ponto.module';
import { PaginaCategoriaComponent } from './pagina-categoria.component';
import { PaginaEditarPontoComponent } from './pagina-editar-ponto.component';
import { PaginaPainelComponent } from './pagina-painel.component';
import { PainelCategoriasComponent } from './painel-categorias.component';
import { PainelPontosComponent } from './painel-pontos.component';

const EDICAO_DO_PONTO: DadosDaRota = { cabecalhoInterno: 'Editar ponto', voltarPara: ROTA_DOS_PONTOS_DO_PAINEL };
const NOVA_CATEGORIA: DadosDaRota = { cabecalhoInterno: 'Nova categoria', voltarPara: ROTA_DAS_CATEGORIAS_DO_PAINEL };
const EDICAO_DA_CATEGORIA: DadosDaRota = { cabecalhoInterno: 'Editar categoria', voltarPara: ROTA_DAS_CATEGORIAS_DO_PAINEL };

@NgModule({
  declarations: [
    PaginaPainelComponent,
    PainelPontosComponent,
    PainelCategoriasComponent,
    PaginaEditarPontoComponent,
    PaginaCategoriaComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CompartilhadoModule,
    FormularioDoPontoModule,
    RouterModule.forChild([
      { path: '', component: PaginaPainelComponent },
      { path: 'pontos/:id/editar', component: PaginaEditarPontoComponent, title: 'Editar ponto · EcoPonto', data: EDICAO_DO_PONTO },
      { path: 'categorias/nova', component: PaginaCategoriaComponent, title: 'Nova categoria · EcoPonto', data: NOVA_CATEGORIA },
      {
        path: 'categorias/:id/editar',
        component: PaginaCategoriaComponent,
        title: 'Editar categoria · EcoPonto',
        data: EDICAO_DA_CATEGORIA,
      },
    ]),
  ],
})
export class PainelModule {}
