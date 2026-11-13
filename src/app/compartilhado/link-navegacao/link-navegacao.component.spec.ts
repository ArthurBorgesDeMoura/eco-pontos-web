import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { CompartilhadoModule } from '../compartilhado.module';

@Component({
  template: `
    <a eco-link-navegacao routerLink="/" [ativo]="ativo">Pontos de coleta</a>
    <a eco-item-barra-inferior routerLink="/" icone="pino" [ativo]="ativo">Pontos</a>
  `,
})
class HospedeiroComponent {
  ativo = false;
}

describe('LinkNavegacaoComponent e ItemBarraInferiorComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let link: HTMLAnchorElement;
  let item: HTMLAnchorElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule, RouterTestingModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.detectChanges();
    [link, item] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
  });

  it('são links de verdade, com o destino da rota', () => {
    expect(link.getAttribute('href')).toBe('/');
    expect(item.getAttribute('href')).toBe('/');
    expect(link.textContent?.trim()).toBe('Pontos de coleta');
    expect(item.textContent?.trim()).toBe('Pontos');
  });

  it('o ativo leva aria-current="page"', () => {
    expect(link.hasAttribute('aria-current')).toBeFalse();
    expect(item.hasAttribute('aria-current')).toBeFalse();

    fixture.componentInstance.ativo = true;
    fixture.detectChanges();
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(item.getAttribute('aria-current')).toBe('page');
    expect(link.classList).toContain('link--ativo');
    expect(item.classList).toContain('item--ativo');
  });

  it('o item da barra inferior tem o ícone de 22 px numa pílula e ocupa 78 × 60 px', () => {
    const caixa = item.getBoundingClientRect();

    expect(item.querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#pino');
    expect(item.querySelector('svg')?.classList).toContain('icone--22');
    expect(caixa.width).toBe(78);
    expect(caixa.height).toBe(60);
  });

  it('o link de navegação tem 32 px de altura', () => {
    expect(link.getBoundingClientRect().height).toBe(32);
  });
});
