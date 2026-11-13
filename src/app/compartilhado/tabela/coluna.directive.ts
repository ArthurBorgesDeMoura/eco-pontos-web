import { Directive, Input, TemplateRef } from '@angular/core';

export type LarguraDaColuna = 'flexivel' | 'larga' | 'acoes' | 'situacao' | 'media' | 'decisao' | 'categoria' | 'numero' | 'editar';

export interface ContextoDaColuna<T = unknown> {
  $implicit: T;
  indice: number;
}

@Directive({ selector: 'ng-template[ecoColuna]' })
export class ColunaDirective {
  @Input() ecoColuna = '';
  @Input() largura: LarguraDaColuna = 'flexivel';

  constructor(readonly modelo: TemplateRef<ContextoDaColuna>) {}
}
