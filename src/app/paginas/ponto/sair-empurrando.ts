import { CanDeactivateFn } from '@angular/router';

import { PaginaPontoComponent } from './pagina-ponto.component';

export const sairEmpurrando: CanDeactivateFn<PaginaPontoComponent> = (tela, _rota, _atual, proximo) =>
  tela.sair(proximo?.url ?? '');
