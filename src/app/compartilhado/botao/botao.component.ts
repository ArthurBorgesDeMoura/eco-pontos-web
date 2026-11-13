import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

export type TipoBotao = 'primario' | 'secundario' | 'texto' | 'exclusao';
export type TamanhoBotao = 'p' | 'm' | 'g';
export type EstadoForcado = 'hover' | 'pressionado' | 'foco' | null;

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[eco-botao], a[eco-botao]',
  templateUrl: './botao.component.html',
  styleUrls: ['./botao.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoComponent {
  @Input() tipo: TipoBotao = 'primario';
  @Input() tamanho: TamanhoBotao = 'm';
  @Input() iconeExterno = false;
  @Input() larguraTotal = false;
  @Input() estadoForcado: EstadoForcado = null;

  @HostBinding('class') get classes(): string {
    return [
      `botao--${this.tipo}`,
      `botao--${this.tamanho}`,
      this.larguraTotal ? 'botao--largura-total' : '',
      this.estadoForcado ? `botao--forcar-${this.estadoForcado}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  get tamanhoDoIcone(): 14 | 16 {
    return this.tamanho === 'p' ? 14 : 16;
  }
}
