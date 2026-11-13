import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TrocaDeTelaService {
  private pedido = false;

  esmaecerProxima(): void {
    this.pedido = true;
  }

  consumir(): boolean {
    const pedido = this.pedido;
    this.pedido = false;
    return pedido;
  }
}
