import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { traduzirErro } from './erro-api';

export type ValorParametro = string | number | boolean | null | undefined;
export type Parametros = Readonly<Record<string, ValorParametro>>;

const COM_CREDENCIAIS = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.enderecoApi.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  get<T>(rota: string, parametros?: Parametros): Observable<T> {
    return this.http
      .get<T>(this.url(rota), { params: montarParametros(parametros), withCredentials: true })
      .pipe(catchError(repassarTraduzido));
  }

  post<T>(rota: string, corpo: unknown = null): Observable<T> {
    return this.http.post<T>(this.url(rota), corpo, COM_CREDENCIAIS).pipe(catchError(repassarTraduzido));
  }

  put<T>(rota: string, corpo: unknown): Observable<T> {
    return this.http.put<T>(this.url(rota), corpo, COM_CREDENCIAIS).pipe(catchError(repassarTraduzido));
  }

  delete<T>(rota: string): Observable<T> {
    return this.http.delete<T>(this.url(rota), COM_CREDENCIAIS).pipe(catchError(repassarTraduzido));
  }

  private url(rota: string): string {
    return `${this.base}/${rota.replace(/^\/+/, '')}`;
  }
}

function repassarTraduzido(erro: unknown): Observable<never> {
  return throwError(() => traduzirErro(erro));
}

function montarParametros(parametros: Parametros = {}): HttpParams {
  let resultado = new HttpParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== null && valor !== undefined && valor !== '') {
      resultado = resultado.set(chave, String(valor));
    }
  }
  return resultado;
}
