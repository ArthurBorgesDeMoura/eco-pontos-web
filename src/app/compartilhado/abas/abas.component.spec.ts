import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { Aba } from './abas.component';

@Component({
  template: `
    <eco-abas rotulo="Painel" [abas]="abas" [(selecionada)]="selecionada">
      <p>Conteúdo de {{ selecionada }}</p>
    </eco-abas>
  `,
})
class HospedeiroComponent {
  abas: Aba[] = [
    { valor: 'pendentes', rotulo: 'Pendentes', contagem: 2 },
    { valor: 'pontos', rotulo: 'Pontos' },
    { valor: 'categorias', rotulo: 'Categorias' },
  ];
  selecionada = 'pontos';
}

describe('AbasComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function abas(): HTMLButtonElement[] {
    return Array.from(elemento.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  function teclar(aba: HTMLElement, tecla: string): void {
    aba.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('segue o padrão de abas da WAI-ARIA', () => {
    const lista = elemento.querySelector('[role="tablist"]') as HTMLElement;
    const painel = elemento.querySelector('[role="tabpanel"]') as HTMLElement;

    expect(lista.getAttribute('aria-label')).toBe('Painel');
    expect(abas().map((aba) => aba.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(abas().map((aba) => aba.tabIndex)).toEqual([-1, 0, -1]);
    expect(abas()[1].getAttribute('aria-controls')).toBe(painel.id);
    expect(painel.getAttribute('aria-labelledby')).toBe(abas()[1].id);
    expect(painel.textContent?.trim()).toBe('Conteúdo de pontos');
  });

  it('mostra a contagem ao lado do rótulo quando houver', () => {
    expect(abas()[0].querySelector('.abas__contagem')?.textContent?.trim()).toBe('2');
    expect(abas()[0].querySelector('.abas__contagem')?.getAttribute('aria-hidden')).toBe('true');
    expect(abas()[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('Pendentes (2)2');
    expect(abas()[0].querySelector('.so-leitor-de-tela')?.textContent?.trim()).toBe('(2)');
    expect(abas()[1].querySelector('.abas__contagem')).toBeNull();
  });

  it('contagem nova não recria os botões: o foco fica na aba', () => {
    const botao = abas()[1];
    botao.focus();
    fixture.componentInstance.abas = fixture.componentInstance.abas.map((aba) => ({ ...aba, contagem: 9 }));
    fixture.detectChanges();
    expect(abas()[1]).toBe(botao);
    expect(document.activeElement).toBe(botao);
  });

  it('clique troca a aba e avisa quem usa', () => {
    abas()[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selecionada).toBe('categorias');
    expect(abas()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('as setas trocam de aba e dão a volta; Home e End vão às pontas; o foco acompanha', () => {
    abas()[1].focus();
    teclar(abas()[1], 'ArrowRight');
    expect(fixture.componentInstance.selecionada).toBe('categorias');
    expect(document.activeElement).toBe(abas()[2]);

    teclar(abas()[2], 'ArrowRight');
    expect(fixture.componentInstance.selecionada).toBe('pendentes');
    expect(document.activeElement).toBe(abas()[0]);

    teclar(abas()[0], 'ArrowLeft');
    expect(fixture.componentInstance.selecionada).toBe('categorias');

    teclar(abas()[2], 'Home');
    expect(fixture.componentInstance.selecionada).toBe('pendentes');
    teclar(abas()[0], 'End');
    expect(fixture.componentInstance.selecionada).toBe('categorias');
    expect(abas().map((aba) => aba.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('tem 44 px de altura e 24 px entre as abas (4 px no celular, para quatro abas caberem)', () => {
    const [primeira, segunda] = abas().map((aba) => aba.getBoundingClientRect());
    const espaco = window.innerWidth >= 768 ? 24 : 4;

    expect(primeira.height).toBe(44);
    expect(segunda.left - primeira.right).toBe(espaco);
  });
});
