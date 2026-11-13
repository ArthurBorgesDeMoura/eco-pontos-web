import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AbasComponent } from './abas/abas.component';
import { AvatarComponent } from './avatar/avatar.component';
import { AvisoComponent } from './aviso/aviso.component';
import { AvisosComponent } from './aviso/avisos.component';
import { BotaoComponent } from './botao/botao.component';
import { CampoTextoComponent } from './campo-texto/campo-texto.component';
import { ChipMaterialComponent } from './chip-material/chip-material.component';
import { DialogosComponent } from './dialogo/dialogos.component';
import { EtiquetaStatusComponent } from './etiqueta-status/etiqueta-status.component';
import { IconeComponent } from './icone/icone.component';
import { ItemBarraInferiorComponent } from './item-barra-inferior/item-barra-inferior.component';
import { ItemFiltroComponent } from './item-filtro/item-filtro.component';
import { LinhaPontoComponent } from './linha-ponto/linha-ponto.component';
import { LinkNavegacaoComponent } from './link-navegacao/link-navegacao.component';
import { MarcaComponent } from './marca/marca.component';
import { BarraInferiorComponent } from './navegacao/barra-inferior.component';
import { BarraSuperiorComponent } from './navegacao/barra-superior.component';
import { CabecalhoCelularComponent } from './navegacao/cabecalho-celular.component';
import { SeletorComponent } from './seletor/seletor.component';
import { CelulaPontoComponent } from './tabela/celula-ponto.component';
import { ColunaDirective } from './tabela/coluna.directive';
import { TabelaComponent } from './tabela/tabela.component';

const COMPONENTES = [
  AbasComponent,
  AvatarComponent,
  AvisoComponent,
  AvisosComponent,
  BarraInferiorComponent,
  BarraSuperiorComponent,
  BotaoComponent,
  CabecalhoCelularComponent,
  CampoTextoComponent,
  CelulaPontoComponent,
  ChipMaterialComponent,
  ColunaDirective,
  DialogosComponent,
  EtiquetaStatusComponent,
  IconeComponent,
  ItemBarraInferiorComponent,
  ItemFiltroComponent,
  LinhaPontoComponent,
  LinkNavegacaoComponent,
  MarcaComponent,
  SeletorComponent,
  TabelaComponent,
];

@NgModule({
  declarations: COMPONENTES,
  imports: [CommonModule, RouterModule],
  exports: COMPONENTES,
})
export class CompartilhadoModule {}
