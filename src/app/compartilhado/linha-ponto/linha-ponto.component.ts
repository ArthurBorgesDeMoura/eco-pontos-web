import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

import { linkDoMapa } from '../mapa';

@Component({
  selector: 'eco-linha-ponto',
  templateUrl: './linha-ponto.component.html',
  styleUrls: ['./linha-ponto.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaPontoComponent {
  @Input() nome = '';
  @Input() bairro = '';
  @Input() endereco = '';
  @Input() materiais: readonly string[] = [];
  @Input() rota: string | readonly unknown[] | null = null;
  @Input() layout: 'auto' | 'linha' | 'cartao' = 'auto';
  @Input() estadoForcado: 'hover' | 'pressionado' | null = null;
  @Input() esqueleto = false;

  @HostBinding('class') get classes(): string {
    return [
      `linha--${this.layout}`,
      this.estadoForcado ? `linha--forcar-${this.estadoForcado}` : '',
      this.esqueleto ? 'linha--esqueleto' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  @HostBinding('attr.aria-hidden') get escondido(): 'true' | null {
    return this.esqueleto ? 'true' : null;
  }

  get local(): string {
    return [this.bairro, this.endereco].filter((parte) => parte.trim() !== '').join(' · ');
  }

  get listaDeMateriais(): string {
    return this.materiais.join(', ');
  }

  get mapa(): string {
    return linkDoMapa(this.endereco, this.bairro);
  }
}
