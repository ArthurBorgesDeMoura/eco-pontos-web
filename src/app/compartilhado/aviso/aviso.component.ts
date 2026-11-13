import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'eco-aviso',
  template: '<ng-content></ng-content>',
  styleUrls: ['./aviso.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoComponent {}
