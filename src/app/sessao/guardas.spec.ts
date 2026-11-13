import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, filter, isObservable, map, take } from 'rxjs';

import { Usuario } from '../api/modelos';
import { apenasVisitante, exigirAdmin, exigirLogin } from './guardas';
import { SessaoService } from './sessao.service';

const MARIA: Usuario = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };
const ADMIN: Usuario = { idUsuario: 1, nome: 'Administrador EcoPonto', email: 'admin@example.com', perfil: 'ADMIN' };

let sessao$: BehaviorSubject<Usuario | null | undefined>;

class SessaoFalsa {
  confirmada(): Observable<Usuario | null> {
    return sessao$.pipe(
      filter((usuario): usuario is Usuario | null => usuario !== undefined),
      take(1),
    );
  }
}

describe('Guardas de rota', () => {
  let router: Router;

  beforeEach(() => {
    sessao$ = new BehaviorSubject<Usuario | null | undefined>(undefined);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: SessaoService, useClass: SessaoFalsa }],
    });
    router = TestBed.inject(Router);
  });

  function rodar(guarda: typeof exigirLogin, url: string): Observable<string | true> {
    const resultado = TestBed.inject(EnvironmentInjector).runInContext(() =>
      guarda({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    const fluxo = isObservable(resultado) ? resultado : new BehaviorSubject(resultado);
    return (fluxo as Observable<boolean | UrlTree>).pipe(
      map((decisao) => (decisao instanceof UrlTree ? router.serializeUrl(decisao) : (decisao as true))),
    );
  }

  function decisao(guarda: typeof exigirLogin, url: string): string | true | undefined {
    let resultado: string | true | undefined;
    rodar(guarda, url).subscribe((valor) => (resultado = valor));
    return resultado;
  }

  it('esperam a sessão carregar antes de decidir', () => {
    let resultado: string | true | undefined;
    rodar(exigirLogin, '/sugerir').subscribe((valor) => (resultado = valor));
    expect(resultado).toBeUndefined();

    sessao$.next(MARIA);
    expect(resultado).toBeTrue();
  });

  it('exigirLogin: o visitante vai a Entrar, com a volta para a tela pedida', () => {
    sessao$.next(null);
    expect(decisao(exigirLogin, '/sugerir')).toBe('/entrar?voltar=%2Fsugerir');

    sessao$.next(MARIA);
    expect(decisao(exigirLogin, '/minhas-sugestoes')).toBeTrue();
  });

  it('exigirAdmin: visitante vai a Entrar, usuário comum vai a "Sem permissão", administrador passa', () => {
    sessao$.next(null);
    expect(decisao(exigirAdmin, '/painel')).toBe('/entrar?voltar=%2Fpainel');

    sessao$.next(MARIA);
    expect(decisao(exigirAdmin, '/painel')).toBe('/sem-permissao');

    sessao$.next(ADMIN);
    expect(decisao(exigirAdmin, '/painel')).toBeTrue();
  });

  it('apenasVisitante: quem já está logado sai de Entrar e Criar conta e vai à busca', () => {
    sessao$.next(null);
    expect(decisao(apenasVisitante, '/entrar')).toBeTrue();

    sessao$.next(MARIA);
    expect(decisao(apenasVisitante, '/entrar')).toBe('/');
  });
});
