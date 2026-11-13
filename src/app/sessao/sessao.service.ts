import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, map, of, take, tap, throwError, timeout } from 'rxjs';

import { ApiService } from '../api/api.service';
import { ErroApi } from '../api/erro-api';
import { Usuario } from '../api/modelos';
import { PerfilDaBarra } from '../compartilhado/navegacao/navegacao';

export const TEMPO_LIMITE_DA_SESSAO_MS = 10_000;

interface EstadoDaSessao {
  carregando: boolean;
  usuario: Usuario | null;
}

@Injectable({ providedIn: 'root' })
export class SessaoService {
  private readonly estado$ = new BehaviorSubject<EstadoDaSessao>({ carregando: true, usuario: null });
  readonly usuario: Observable<Usuario | null> = this.estado$.pipe(map((estado) => estado.usuario));
  readonly carregando: Observable<boolean> = this.estado$.pipe(map((estado) => estado.carregando));

  constructor(private readonly api: ApiService) {}

  get atual(): Usuario | null {
    return this.estado$.value.usuario;
  }

  get estaCarregando(): boolean {
    return this.estado$.value.carregando;
  }

  carregar(): Observable<Usuario | null> {
    return this.api.get<Usuario>('auth/eu').pipe(
      timeout(TEMPO_LIMITE_DA_SESSAO_MS),
      catchError(() => of(null)),
      tap((usuario) => this.estado$.next({ carregando: false, usuario })),
    );
  }

  confirmada(): Observable<Usuario | null> {
    return this.estado$.pipe(
      filter((estado) => !estado.carregando),
      take(1),
      map((estado) => estado.usuario),
    );
  }

  entrar(email: string, senha: string): Observable<Usuario> {
    return this.api
      .post<Usuario>('auth/login', { email: email.trim(), senha })
      .pipe(tap((usuario) => this.definir(usuario)));
  }

  cadastrar(nome: string, email: string, senha: string): Observable<Usuario> {
    return this.api.post<Usuario>('auth/cadastro', { nome: nome.trim(), email: email.trim(), senha });
  }

  sair(): Observable<void> {
    return this.api.post<unknown>('auth/logout').pipe(
      catchError((erro: unknown) => (erro instanceof ErroApi && erro.status === 401 ? of(null) : throwError(() => erro))),
      tap(() => this.limpar()),
      map(() => undefined),
    );
  }

  limpar(): void {
    this.definir(null);
  }

  private definir(usuario: Usuario | null): void {
    this.estado$.next({ carregando: false, usuario });
  }
}

export function perfilDaBarra(usuario: Usuario | null): PerfilDaBarra {
  if (!usuario) {
    return 'visitante';
  }
  return usuario.perfil === 'ADMIN' ? 'administrador' : 'usuario';
}
