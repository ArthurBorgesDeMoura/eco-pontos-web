import {
  HTTP_INTERCEPTORS,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, Provider } from '@angular/core';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CorpoErroApi } from '../erro-api';
import { AcessoSimulado } from './acesso-simulado';
import { PainelSimulado } from './painel-simulado';
import { PontosSimulados } from './pontos-simulados';
import { BAIRROS } from './respostas/bairros';
import { RespostaSimulada, RotaSimulada } from './rota-simulada';

const ROTAS_DE_CONSULTA: readonly RotaSimulada[] = [
  { metodo: 'GET', caminho: /^\/bairros$/, responder: () => ({ status: 200, corpo: BAIRROS }) },
];

@Injectable()
export class SimulacaoInterceptor implements HttpInterceptor {
  private readonly prefixo = environment.enderecoApi.replace(/\/+$/, '');
  private readonly rotas: readonly RotaSimulada[] = criarRotas();

  intercept(pedido: HttpRequest<unknown>, proximo: HttpHandler): Observable<HttpEvent<unknown>> {
    const caminho = this.caminhoNaApi(pedido.url);
    if (caminho === null) {
      return proximo.handle(pedido);
    }

    const rota = this.rotas.find((r) => r.metodo === pedido.method && r.caminho.test(caminho));
    const resposta: RespostaSimulada = rota
      ? rota.responder(pedido)
      : { status: 404, corpo: semSimulacao(pedido) };
    const atraso = environment.atrasoSimulacaoMs;

    if (resposta.status >= 400) {
      return timer(atraso).pipe(
        mergeMap(() =>
          throwError(() => new HttpErrorResponse({ status: resposta.status, error: resposta.corpo, url: pedido.url })),
        ),
      );
    }
    const corpo: unknown = resposta.corpo === null ? null : JSON.parse(JSON.stringify(resposta.corpo));
    return of(new HttpResponse({ status: resposta.status, body: corpo, url: pedido.url })).pipe(delay(atraso));
  }

  private caminhoNaApi(url: string): string | null {
    const semConsulta = url.split(/[?#]/)[0];
    if (semConsulta === this.prefixo) {
      return '/';
    }
    return semConsulta.startsWith(`${this.prefixo}/`) ? semConsulta.slice(this.prefixo.length) : null;
  }
}

function criarRotas(): readonly RotaSimulada[] {
  const pontos = new PontosSimulados();
  const acesso = new AcessoSimulado();
  const painel = new PainelSimulado(pontos.pontos, pontos.categorias, (idUsuario) => acesso.nomeDoUsuario(idUsuario));
  return [...ROTAS_DE_CONSULTA, ...pontos.rotas, ...painel.rotas, ...acesso.rotas];
}

function semSimulacao(pedido: HttpRequest<unknown>): CorpoErroApi {
  console.warn(`[simulação] ${pedido.method} ${pedido.url} ainda não tem resposta simulada.`);
  return { codigo: 'SEM_SIMULACAO', mensagem: 'Esta rota ainda não tem resposta simulada.' };
}

export const PROVEDOR_DA_SIMULACAO: Provider = { provide: HTTP_INTERCEPTORS, useClass: SimulacaoInterceptor, multi: true };
