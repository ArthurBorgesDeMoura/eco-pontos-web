import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';

import { indiceDaTecla } from '../teclado';

export interface Aba {
  readonly valor: string;
  readonly rotulo: string;
  readonly contagem?: number | null;
}

let proximoId = 1;

@Component({
  selector: 'eco-abas',
  templateUrl: './abas.component.html',
  styleUrls: ['./abas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbasComponent {
  @Input() abas: readonly Aba[] = [];
  @Input() rotulo = '';
  @Input() selecionada: string | null = null;
  @Output() readonly selecionadaChange = new EventEmitter<string>();

  @ViewChildren('botaoDaAba') private botoes!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly id = `abas-${proximoId++}`;

  get indiceSelecionado(): number {
    const indice = this.abas.findIndex((aba) => aba.valor === this.selecionada);
    return indice >= 0 ? indice : 0;
  }

  porValor(_indice: number, aba: Aba): string {
    return aba.valor;
  }

  escolher(indice: number): void {
    const aba = this.abas[indice];
    if (aba && aba.valor !== this.selecionada) {
      this.selecionada = aba.valor;
      this.selecionadaChange.emit(aba.valor);
    }
  }

  aoTeclar(evento: KeyboardEvent, atual: number): void {
    const proximo = indiceDaTecla(evento.key, atual, this.abas.length, { orientacao: 'horizontal', circular: true });
    if (proximo === null) {
      return;
    }
    evento.preventDefault();
    this.escolher(proximo);
    this.botoes.get(proximo)?.nativeElement.focus();
  }
}
