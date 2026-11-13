import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OpcoesDeConfirmacao {
  titulo: string;
  texto: string;
  confirmar: string;
  cancelar?: string;
  tipo?: 'primario' | 'exclusao';
}

export interface PedidoDeConfirmacao extends Required<OpcoesDeConfirmacao> {
  readonly id: number;
}

@Injectable({ providedIn: 'root' })
export class DialogoService {
  private proximoId = 1;
  private resolver: ((confirmado: boolean) => void) | null = null;
  private readonly atual$ = new BehaviorSubject<PedidoDeConfirmacao | null>(null);
  readonly atual: Observable<PedidoDeConfirmacao | null> = this.atual$.asObservable();

  confirmar(opcoes: OpcoesDeConfirmacao): Promise<boolean> {
    this.responder(false);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.atual$.next({ cancelar: 'Cancelar', tipo: 'primario', ...opcoes, id: this.proximoId++ });
    });
  }

  responder(confirmado: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    if (resolver) {
      this.atual$.next(null);
      resolver(confirmado);
    }
  }
}
