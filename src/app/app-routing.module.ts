import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DadosDaRota } from './dados-da-rota';
import { PaginaCriarContaComponent } from './paginas/acesso/pagina-criar-conta.component';
import { PaginaEntrarComponent } from './paginas/acesso/pagina-entrar.component';
import { PaginaPontoComponent } from './paginas/ponto/pagina-ponto.component';
import { sairEmpurrando } from './paginas/ponto/sair-empurrando';
import { PaginaPontosComponent } from './paginas/pontos/pagina-pontos.component';
import { PaginaNaoEncontradaComponent } from './paginas/situacao/pagina-nao-encontrada.component';
import { PaginaSemPermissaoComponent } from './paginas/situacao/pagina-sem-permissao.component';
import { ROTAS_DE_DESENVOLVIMENTO } from './rotas-de-desenvolvimento';
import { ROTA } from './rotas';
import { ROTA_SEM_PERMISSAO, apenasVisitante, exigirAdmin, exigirLogin } from './sessao/guardas';

const ACESSO: DadosDaRota = { barras: 'acesso' };

const caminho = (rota: string): string => rota.replace(/^\//, '');

const BUSCA: DadosDaRota = { pagina: 'pontos' };
const DETALHE: DadosDaRota = { pagina: 'pontos', cabecalhoInterno: 'Detalhes do ponto' };

const routes: Routes = [
  { path: '', pathMatch: 'full', component: PaginaPontosComponent, title: 'Pontos de coleta · EcoPonto', data: BUSCA },
  {
    path: 'pontos/:id',
    component: PaginaPontoComponent,
    title: 'Detalhes do ponto · EcoPonto',
    data: DETALHE,
    canDeactivate: [sairEmpurrando],
  },
  {
    path: caminho(ROTA.entrar),
    component: PaginaEntrarComponent,
    title: 'Entrar · EcoPonto',
    data: ACESSO,
    canActivate: [apenasVisitante],
  },
  {
    path: caminho(ROTA.criarConta),
    component: PaginaCriarContaComponent,
    title: 'Criar conta · EcoPonto',
    data: ACESSO,
    canActivate: [apenasVisitante],
  },
  {
    path: caminho(ROTA.sugerir),
    title: 'Sugerir novo ponto · EcoPonto',
    data: { pagina: 'sugerir' } as DadosDaRota,
    canActivate: [exigirLogin],
    loadChildren: () => import('./paginas/sugerir/sugerir.module').then((m) => m.SugerirModule),
  },
  {
    path: caminho(ROTA.minhasSugestoes),
    title: 'Minhas sugestões · EcoPonto',
    data: { pagina: 'minhas' } as DadosDaRota,
    canActivate: [exigirLogin],
    loadChildren: () => import('./paginas/minhas-sugestoes/minhas-sugestoes.module').then((m) => m.MinhasSugestoesModule),
  },
  {
    path: caminho(ROTA.painel),
    title: 'Painel · EcoPonto',
    data: { pagina: 'painel' } as DadosDaRota,
    canActivate: [exigirAdmin],
    loadChildren: () => import('./paginas/painel/painel.module').then((m) => m.PainelModule),
  },
  { path: caminho(ROTA_SEM_PERMISSAO), component: PaginaSemPermissaoComponent, title: 'Sem permissão · EcoPonto' },
  ...ROTAS_DE_DESENVOLVIMENTO,
  { path: '**', component: PaginaNaoEncontradaComponent, title: 'Página não encontrada · EcoPonto' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { canceledNavigationResolution: 'computed' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
