import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[eco-link-navegacao]',
  template: '<ng-content></ng-content>',
  styleUrls: ['./link-navegacao.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkNavegacaoComponent {
  @Input() ativo = false;
  @Input() estadoForcado: 'hover' | null = null;

  @HostBinding('class.link--ativo') get classeAtivo(): boolean {
    return this.ativo;
  }

  @HostBinding('class.link--forcar-hover') get classeHover(): boolean {
    return this.estadoForcado === 'hover';
  }

  @HostBinding('attr.aria-current') get atual(): 'page' | null {
    return this.ativo ? 'page' : null;
  }
}
