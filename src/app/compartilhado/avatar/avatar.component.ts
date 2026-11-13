import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'eco-avatar',
  template: '<span aria-hidden="true">{{ inicial }}</span>',
  styleUrls: ['./avatar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  @Input() nome = '';

  get inicial(): string {
    return this.nome.trim().charAt(0).toLocaleUpperCase('pt-BR');
  }
}
