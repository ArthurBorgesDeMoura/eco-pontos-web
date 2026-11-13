import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[eco-item-filtro]',
  template: `
    <span class="item__rotulo"
      ><span class="item__nome"><ng-content></ng-content></span
      ><span *ngIf="contagem !== null" class="so-leitor-de-tela">
        ({{ contagem }} {{ contagem === 1 ? unidade.singular : unidade.plural }})</span
      ></span
    >
    <span *ngIf="contagem !== null" class="item__contagem" aria-hidden="true">{{ contagem }}</span>
  `,
  styleUrls: ['./item-filtro.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFiltroComponent {
  @Input() selecionado = false;
  @Input() contagem: number | null = null;
  @Input() unidade: { singular: string; plural: string } = { singular: 'ponto', plural: 'pontos' };
  @Input() estadoForcado: 'hover' | null = null;
  @HostBinding('attr.type') readonly tipo = 'button';

  @HostBinding('attr.aria-pressed') get pressionado(): 'true' | 'false' {
    return this.selecionado ? 'true' : 'false';
  }

  @HostBinding('class.item--selecionado') get classeSelecionado(): boolean {
    return this.selecionado;
  }

  @HostBinding('class.item--forcar-hover') get classeHover(): boolean {
    return this.estadoForcado === 'hover';
  }
}
