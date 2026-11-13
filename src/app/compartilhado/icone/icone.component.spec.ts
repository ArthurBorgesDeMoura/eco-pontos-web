import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconeComponent } from './icone.component';
import { NOMES_ICONES } from './nomes-icones';

describe('IconeComponent', () => {
  let fixture: ComponentFixture<IconeComponent>;

  function svg(): SVGSVGElement {
    return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [IconeComponent] }).compileComponents();
    fixture = TestBed.createComponent(IconeComponent);
    fixture.componentInstance.nome = 'busca';
  });

  it('tem os 16 ícones do quadro Ícones do Figma e o símbolo da marca', () => {
    expect(NOMES_ICONES.length).toBe(17);
    expect(NOMES_ICONES).toContain('seta-diagonal');
    expect(NOMES_ICONES).toContain('marca');
  });

  it('usa o símbolo do sprite pelo nome', () => {
    fixture.detectChanges();

    expect(svg().querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#busca');
  });

  it('sem rótulo, é decorativo e some para leitores de tela', () => {
    fixture.detectChanges();

    expect(svg().getAttribute('aria-hidden')).toBe('true');
    expect(svg().hasAttribute('role')).toBeFalse();
    expect(svg().getAttribute('focusable')).toBe('false');
  });

  it('com rótulo, é anunciado como imagem', () => {
    fixture.componentInstance.rotulo = 'Abrir no mapa';
    fixture.detectChanges();

    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Abrir no mapa');
    expect(svg().hasAttribute('aria-hidden')).toBeFalse();
  });

  it('tem 24 px por padrão, como no Figma, e aceita 14, 16, 20 e 22 px, pelos tokens', () => {
    fixture.detectChanges();
    expect(svg().getBoundingClientRect().width).toBe(24);

    for (const tamanho of [14, 16, 20, 22] as const) {
      fixture = TestBed.createComponent(IconeComponent);
      fixture.componentInstance.nome = 'busca';
      fixture.componentInstance.tamanho = tamanho;
      fixture.detectChanges();
      expect(svg().classList).toContain(`icone--${tamanho}`);
      expect(svg().getBoundingClientRect().width).toBe(tamanho);
    }
  });
});
