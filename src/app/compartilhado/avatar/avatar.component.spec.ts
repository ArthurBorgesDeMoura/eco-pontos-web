import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [AvatarComponent] }).compileComponents();
    fixture = TestBed.createComponent(AvatarComponent);
  });

  it('mostra a inicial do nome em maiúscula, escondida de leitores de tela', () => {
    fixture.componentInstance.nome = '  maria Souza';
    fixture.detectChanges();
    const letra = (fixture.nativeElement as HTMLElement).querySelector('span') as HTMLElement;

    expect(letra.textContent).toBe('M');
    expect(letra.getAttribute('aria-hidden')).toBe('true');
  });

  it('é um círculo de 28 px, como no Figma', () => {
    fixture.componentInstance.nome = 'Administrador EcoPonto';
    fixture.detectChanges();
    const caixa = (fixture.nativeElement as HTMLElement).getBoundingClientRect();

    expect(fixture.componentInstance.inicial).toBe('A');
    expect(caixa.width).toBe(28);
    expect(caixa.height).toBe(28);
  });
});
