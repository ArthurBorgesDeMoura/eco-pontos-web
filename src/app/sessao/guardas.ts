import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';

import { Usuario } from '../api/modelos';
import { ROTA } from '../rotas';
import { SessaoService } from './sessao.service';

export const ROTA_SEM_PERMISSAO = '/sem-permissao';

type Decisao = boolean | UrlTree;

export const exigirLogin: CanActivateFn = (_rota, estado) =>
  decidir((usuario, router) => (usuario ? true : paraEntrar(router, estado.url)));

export const exigirAdmin: CanActivateFn = (_rota, estado) =>
  decidir((usuario, router) => {
    if (!usuario) {
      return paraEntrar(router, estado.url);
    }
    return usuario.perfil === 'ADMIN' ? true : router.parseUrl(ROTA_SEM_PERMISSAO);
  });

export const apenasVisitante: CanActivateFn = () =>
  decidir((usuario, router) => (usuario ? router.parseUrl(ROTA.pontos) : true));

function decidir(regra: (usuario: Usuario | null, router: Router) => Decisao): Observable<Decisao> {
  const router = inject(Router);
  return inject(SessaoService)
    .confirmada()
    .pipe(map((usuario) => regra(usuario, router)));
}

function paraEntrar(router: Router, destino: string): UrlTree {
  return router.createUrlTree([ROTA.entrar], { queryParams: { voltar: destino } });
}
