import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { PROVEDORES_DA_SIMULACAO } from './api/simulacao/provedores-da-simulacao';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CompartilhadoModule } from './compartilhado/compartilhado.module';
import { AcessoModule } from './paginas/acesso/acesso.module';
import { PontoModule } from './paginas/ponto/ponto.module';
import { PontosModule } from './paginas/pontos/pontos.module';
import { SituacaoModule } from './paginas/situacao/situacao.module';
import { PROVEDOR_DA_SESSAO_EXPIRADA } from './sessao/sessao-expirada.interceptor';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, AppRoutingModule, CompartilhadoModule, AcessoModule, PontosModule, PontoModule, SituacaoModule],
  providers: [PROVEDOR_DA_SESSAO_EXPIRADA, ...PROVEDORES_DA_SIMULACAO],
  bootstrap: [AppComponent],
})
export class AppModule {}
