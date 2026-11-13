import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VersaoDosDadosService {
  private atual = 0;

  get versao(): number {
    return this.atual;
  }

  mudou(): void {
    this.atual++;
  }
}
