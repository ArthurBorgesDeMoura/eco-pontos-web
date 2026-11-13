import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  TrackByFunction,
  ViewChild,
} from '@angular/core';

import { ColunaDirective } from './coluna.directive';

@Component({
  selector: 'eco-tabela',
  templateUrl: './tabela.component.html',
  styleUrls: ['./tabela.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabelaComponent implements OnChanges, AfterViewChecked {
  @Input() legenda = '';
  @Input() itens: readonly unknown[] = [];
  @Input() total: number | null = null;
  @Input() itemNoSingular = 'ponto';
  @Input() itemNoPlural = 'pontos';
  @Input() mensagemVazia = '';
  @Input() carregando = false;
  @Input() textoDoResumo: string | null = null;
  @Input() itensSaindo: readonly unknown[] = [];
  @Input() compacta = false;
  @Input() rastrearPor: TrackByFunction<unknown> = (indice) => indice;
  @Output() readonly mostrarMais = new EventEmitter<void>();

  @ContentChildren(ColunaDirective) colunas!: QueryList<ColunaDirective>;
  @ViewChild('resumoDaLista') private resumoDaLista?: ElementRef<HTMLElement>;

  private esperandoMais = false;
  private focarResumo = false;

  @HostBinding('class.tabela--sem-rodape') get semRodape(): boolean {
    return this.total === null;
  }

  @HostBinding('class.tabela--compacta') get comLinhasCompactas(): boolean {
    return this.compacta;
  }

  get resumo(): string {
    if (this.textoDoResumo !== null) {
      return this.textoDoResumo;
    }
    const total = this.total ?? 0;
    return `Mostrando ${this.itens.length} de ${total} ${total === 1 ? this.itemNoSingular : this.itemNoPlural}`;
  }

  get haMais(): boolean {
    return this.total !== null && this.itens.length - this.itensSaindo.length < this.total;
  }

  pedirMais(): void {
    if (this.carregando) {
      return;
    }
    this.esperandoMais = true;
    this.mostrarMais.emit();
  }

  ngOnChanges(mudancas: SimpleChanges): void {
    if (this.esperandoMais && !this.carregando && (mudancas['itens'] || mudancas['total'])) {
      this.esperandoMais = false;
      this.focarResumo = !this.haMais;
    }
  }

  ngAfterViewChecked(): void {
    if (this.focarResumo) {
      this.focarResumo = false;
      this.resumoDaLista?.nativeElement.focus();
    }
  }
}
