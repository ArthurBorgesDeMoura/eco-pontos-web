import { ActivatedRouteSnapshot } from '@angular/router';

import { PaginaDaBarra } from './compartilhado/navegacao/navegacao';

export interface DadosDaRota {
  barras?: 'acesso' | 'nenhuma';
  pagina?: PaginaDaBarra;
  cabecalhoInterno?: string;
  voltarPara?: string;
}

export function dadosDaRotaAtual(raiz: ActivatedRouteSnapshot): DadosDaRota {
  let rota = raiz;
  while (rota.firstChild) {
    rota = rota.firstChild;
  }
  return rota.data as DadosDaRota;
}
