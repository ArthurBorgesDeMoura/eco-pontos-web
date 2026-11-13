import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'eco-celula-ponto',
  template: `
    <span class="celula__nome">{{ nome }}</span>
    <span class="celula__local"> {{ local }}</span>
    <span *ngIf="detalhe" class="celula__detalhe"> {{ detalhe }}</span>
  `,
  styleUrls: ['./celula-ponto.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CelulaPontoComponent {
  @Input() nome = '';
  @Input() bairro = '';
  @Input() endereco = '';
  @Input() detalhe = '';

  get local(): string {
    return [this.bairro, this.endereco].filter((parte) => parte.trim() !== '').join(' · ');
  }
}
