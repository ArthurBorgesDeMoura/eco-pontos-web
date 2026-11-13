import { Injectable } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, map, tap } from 'rxjs';

import { ApiService } from './api.service';
import { ErroApi } from './erro-api';
import {
  CategoriaDoPainel,
  NovaCategoria,
  NovaSugestao,
  PaginaDeCategorias,
  PaginaDoPainel,
  PontoDetalhe,
  PontoDoPainel,
  ResumoDoPainel,
  StatusDoPonto,
} from './modelos';
import { comoPagina } from './pagina';
import { PONTOS_POR_PAGINA } from './pontos.service';
import { VersaoDosDadosService } from './versao-dos-dados.service';

export type Decisao = 'aprovar' | 'recusar';

export const MAIOR_PAGINA_DO_PAINEL = 50;

@Injectable({ providedIn: 'root' })
export class PainelService {
  constructor(
    private readonly api: ApiService,
    private readonly versaoDosDados: VersaoDosDadosService,
  ) {}

  resumo(): Observable<ResumoDoPainel> {
    return this.api.get<ResumoDoPainel>('admin/resumo');
  }

  pontos(status: StatusDoPonto = 'PENDENTE', pagina = 1, tamanho = PONTOS_POR_PAGINA): Observable<PaginaDoPainel> {
    return this.api
      .get<PaginaDoPainel | PontoDoPainel[]>('admin/pontos', { status, pagina, tamanho })
      .pipe(map((resposta) => comoPagina(resposta, pagina)));
  }

  decidir(idPonto: number, decisao: Decisao): Observable<PontoDoPainel> {
    return this.api.post<PontoDoPainel>(`admin/pontos/${encodeURIComponent(idPonto)}/${decisao}`).pipe(this.mudaOsDados());
  }

  editar(idPonto: number, dados: NovaSugestao): Observable<PontoDetalhe> {
    return this.api.put<PontoDetalhe>(`admin/pontos/${encodeURIComponent(idPonto)}`, dados).pipe(this.mudaOsDados());
  }

  excluir(idPonto: number): Observable<void> {
    return this.api.delete<void>(`admin/pontos/${encodeURIComponent(idPonto)}`).pipe(this.mudaOsDados());
  }

  categorias(pagina = 1, tamanho = MAIOR_PAGINA_DO_PAINEL): Observable<PaginaDeCategorias> {
    return this.api
      .get<PaginaDeCategorias | CategoriaDoPainel[]>('admin/categorias', { pagina, tamanho })
      .pipe(map((resposta) => comoPagina(resposta, pagina)));
  }

  criarCategoria(dados: NovaCategoria): Observable<CategoriaDoPainel> {
    return this.api.post<CategoriaDoPainel>('admin/categorias', dados).pipe(this.mudaOsDados());
  }

  editarCategoria(idCategoria: number, dados: NovaCategoria): Observable<CategoriaDoPainel> {
    return this.api.put<CategoriaDoPainel>(`admin/categorias/${encodeURIComponent(idCategoria)}`, dados).pipe(this.mudaOsDados());
  }

  private mudaOsDados<T>(): MonoTypeOperatorFunction<T> {
    return tap({
      next: () => this.versaoDosDados.mudou(),
      error: (erro: unknown) => {
        if (erro instanceof ErroApi && (erro.status === 404 || erro.status === 409)) {
          this.versaoDosDados.mudou();
        }
      },
    });
  }
}
