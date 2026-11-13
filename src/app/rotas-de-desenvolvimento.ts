import { Routes } from '@angular/router';

import { DadosDaRota } from './dados-da-rota';

const SEM_BARRAS: DadosDaRota = { barras: 'nenhuma' };

export const ROTAS_DE_DESENVOLVIMENTO: Routes = [
  {
    path: 'sistema',
    loadChildren: () => import('./paginas/sistema/sistema.module').then((m) => m.SistemaModule),
  },
  {
    path: 'catalogo',
    data: SEM_BARRAS,
    loadChildren: () => import('./paginas/catalogo/catalogo.module').then((m) => m.CatalogoModule),
  },
];
