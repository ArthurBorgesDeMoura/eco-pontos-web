import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';

@Component({
  template: `
    <button eco-item-filtro [selecionado]="escolhido === 0" [contagem]="13" (click)="escolhido = 0">
      Todos os materiais
    </button>
    <button eco-item-filtro [selecionado]="escolhido === 1" [contagem]="3" (click)="escolhido = 1">
      Papel e papelão
    </button>
  `,
})
class HospedeiroComponent {
  escolhido = 0;
}

describe('ItemFiltroComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let botoes: HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.detectChanges();
    botoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  });

  it('é um botão com o rótulo, a contagem e aria-pressed', () => {
    expect(botoes[0].type).toBe('button');
    expect(botoes[0].querySelector('.item__nome')?.textContent?.trim()).toBe('Todos os materiais');
    expect(botoes[0].querySelector('.item__contagem')?.textContent?.trim()).toBe('13');
    expect(botoes[0].querySelector('.item__contagem')?.getAttribute('aria-hidden')).toBe('true');
    const rotulo = botoes[0].querySelector('.item__rotulo')?.textContent ?? '';
    expect(rotulo.replace(/\s+/g, ' ').trim()).toBe('Todos os materiais (13 pontos)');
    expect(botoes[0].getAttribute('aria-pressed')).toBe('true');
    expect(botoes[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('só um fica selecionado por vez', () => {
    botoes[1].click();
    fixture.detectChanges();

    expect(botoes[0].getAttribute('aria-pressed')).toBe('false');
    expect(botoes[1].getAttribute('aria-pressed')).toBe('true');
    expect(botoes[1].classList).toContain('item--selecionado');
  });

  it('tem 36 px de altura, como no Figma', () => {
    expect(botoes[0].getBoundingClientRect().height).toBe(36);
  });
});
