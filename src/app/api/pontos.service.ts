import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ContagemDePontos, NovaSugestao, PaginaDePontos, PontoCriado, PontoDetalhe } from './modelos';

export const PONTOS_POR_PAGINA = 7;

export interface FiltrosDaBusca {
  bairro: number | null;
  categoria: number | null;
}

@Injectable({ providedIn: 'root' })
export class PontosService {
  constructor(private readonly api: ApiService) {}

  listar(filtros: FiltrosDaBusca, pagina = 1): Observable<PaginaDePontos> {
    return this.api.get<PaginaDePontos>('pontos', {
      bairro: filtros.bairro,
      categoria: filtros.categoria,
      pagina,
      tamanho: PONTOS_POR_PAGINA,
    });
  }

  contar(bairro: number | null): Observable<ContagemDePontos> {
    return this.api.get<ContagemDePontos>('pontos/contagem', { bairro });
  }

  detalhar(idPonto: number): Observable<PontoDetalhe> {
    return this.api.get<PontoDetalhe>(`pontos/${idPonto}`);
  }

  sugerir(dados: NovaSugestao): Observable<PontoCriado> {
    return this.api.post<PontoCriado>('pontos', dados);
  }
}
