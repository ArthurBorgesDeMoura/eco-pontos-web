import { HTTP_INTERCEPTORS, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, Injector, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';

import { ROTA } from '../rotas';
import { SessaoService } from './sessao.service';

const ROTAS_DE_AUTENTICACAO = /\/auth\/(login|cadastro|eu|logout)$/;

@Injectable()
export class SessaoExpiradaInterceptor implements HttpInterceptor {
  constructor(private readonly injector: Injector) {}

  private indoParaEntrar = false;

  intercept(pedido: HttpRequest<unknown>, proximo: HttpHandler): Observable<HttpEvent<unknown>> {
    return proximo.handle(pedido).pipe(
      catchError((erro: unknown) => {
        if (erro instanceof HttpErrorResponse && erro.status === 401 && !ROTAS_DE_AUTENTICACAO.test(urlSemConsulta(pedido.url))) {
          this.sessaoTerminou();
        }
        return throwError(() => erro);
      }),
    );
  }

  private sessaoTerminou(): void {
    if (this.indoParaEntrar) {
      return;
    }
    const sessao = this.injector.get(SessaoService);
    const router = this.injector.get(Router);
    const estavaLogado = sessao.atual !== null;
    sessao.limpar();
    const agora = router.url;
    if (agora.split(/[?#]/)[0] === ROTA.entrar) {
      return;
    }
    const queryParams: Record<string, string> = { voltar: agora };
    if (estavaLogado) {
      queryParams['motivo'] = 'sessao';
    }
    this.indoParaEntrar = true;
    void router.navigate([ROTA.entrar], { queryParams, replaceUrl: true }).finally(() => (this.indoParaEntrar = false));
  }
}

function urlSemConsulta(url: string): string {
  return url.split(/[?#]/)[0];
}

export const PROVEDOR_DA_SESSAO_EXPIRADA: Provider = {
  provide: HTTP_INTERCEPTORS,
  useClass: SessaoExpiradaInterceptor,
  multi: true,
};
