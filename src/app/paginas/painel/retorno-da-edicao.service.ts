import { Injectable } from '@angular/core';

export type AbaComRetorno = 'pontos' | 'categorias';

export interface RetornoDaEdicao {
  aba: AbaComRetorno;
  carregados: number;
  id: number | null;
}

@Injectable({ providedIn: 'root' })
export class RetornoDaEdicaoService {
  private guardado: (RetornoDaEdicao & { posicao: number }) | null = null;

  guardar(posicao: number, retorno: RetornoDaEdicao): void {
    this.guardado = { ...retorno, posicao };
  }

  definirId(id: number): void {
    if (this.guardado) {
      this.guardado = { ...this.guardado, id };
    }
  }

  retomar(posicao: number, aba: AbaComRetorno): RetornoDaEdicao | null {
    const guardado = this.guardado;
    this.guardado = null;
    if (!guardado || guardado.posicao !== posicao || guardado.aba !== aba) {
      return null;
    }
    return { aba: guardado.aba, carregados: guardado.carregados, id: guardado.id };
  }
}
