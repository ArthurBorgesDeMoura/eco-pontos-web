import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Aviso {
  readonly id: number;
  readonly texto: string;
}

export const DURACAO_DO_AVISO_MS = 4000;

@Injectable({ providedIn: 'root' })
export class AvisoService {
  private proximoId = 1;
  private readonly atual$ = new BehaviorSubject<Aviso | null>(null);
  readonly atual: Observable<Aviso | null> = this.atual$.asObservable();

  mostrar(texto: string): void {
    const limpo = texto.trim();
    if (limpo !== '') {
      this.atual$.next({ id: this.proximoId++, texto: limpo });
    }
  }

  fechar(id: number): void {
    if (this.atual$.value?.id === id) {
      this.atual$.next(null);
    }
  }
}
