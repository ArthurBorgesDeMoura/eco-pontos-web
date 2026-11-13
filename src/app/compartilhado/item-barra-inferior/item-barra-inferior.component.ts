import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

import { NomeIcone } from '../icone/nomes-icones';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[eco-item-barra-inferior]',
  templateUrl: './item-barra-inferior.component.html',
  styleUrls: ['./item-barra-inferior.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemBarraInferiorComponent {
  @Input() icone!: NomeIcone;
  @Input() ativo = false;

  @HostBinding('class.item--ativo') get classeAtivo(): boolean {
    return this.ativo;
  }

  @HostBinding('attr.aria-current') get atual(): 'page' | null {
    return this.ativo ? 'page' : null;
  }
}
