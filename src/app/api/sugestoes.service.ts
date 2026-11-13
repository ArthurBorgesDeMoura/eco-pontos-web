import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from './api.service';
import { PaginaDeSugestoes, StatusDoPonto, Sugestao } from './modelos';
import { comoPagina } from './pagina';
import { PONTOS_POR_PAGINA } from './pontos.service';

@Injectable({ providedIn: 'root' })
export class SugestoesService {
  constructor(private readonly api: ApiService) {}

  minhas(status: StatusDoPonto | null, pagina = 1): Observable<PaginaDeSugestoes> {
    return this.api
      .get<PaginaDeSugestoes | Sugestao[]>('minhas-sugestoes', { status, pagina, tamanho: PONTOS_POR_PAGINA })
      .pipe(map((resposta) => comoPagina(resposta, pagina)));
  }
}
