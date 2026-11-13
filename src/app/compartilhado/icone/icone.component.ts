import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { NomeIcone } from './nomes-icones';

export type TamanhoIcone = 14 | 16 | 20 | 22 | 24;

export const CAMINHO_SPRITE = 'assets/icones.svg';

@Component({
  selector: 'eco-icone',
  templateUrl: './icone.component.html',
  styleUrls: ['./icone.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconeComponent {
  @Input() nome!: NomeIcone;
  @Input() rotulo?: string;
  @Input() tamanho: TamanhoIcone = 24;

  get endereco(): string {
    return `${CAMINHO_SPRITE}#${this.nome}`;
  }
}
