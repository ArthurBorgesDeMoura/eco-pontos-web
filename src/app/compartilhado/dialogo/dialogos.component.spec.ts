import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { DialogoService } from './dialogo.service';

const SAIDA_MS = 400;

@Component({
  template: `
    <button type="button" class="origem" (click)="abrir()">Excluir</button>
    <button type="button" class="em-sequencia" (click)="abrirEmSequencia()">Excluir e confirmar de novo</button>
    <eco-dialogos></eco-dialogos>
  `,
})
class HospedeiroComponent {
  respostas: boolean[] = [];

  constructor(private readonly dialogos: DialogoService) {}

  abrir(): void {
    void this.dialogos
      .confirmar({
        titulo: 'Excluir este ponto?',
        texto: 'Pão de Açúcar sai da busca.',
        confirmar: 'Excluir ponto',
        tipo: 'exclusao',
      })
      .then((resposta) => this.respostas.push(resposta));
  }

  async abrirEmSequencia(): Promise<void> {
    if (await this.dialogos.confirmar({ titulo: 'Primeiro?', texto: 'Um.', confirmar: 'Sim' })) {
      this.respostas.push(await this.dialogos.confirmar({ titulo: 'Segundo?', texto: 'Dois.', confirmar: 'Sim' }));
    }
  }
}

describe('DialogosComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function janela(): HTMLElement | null {
    return elemento.querySelector('[role="alertdialog"]');
  }

  function botoes(): HTMLButtonElement[] {
    return Array.from(janela()?.querySelectorAll('button') ?? []);
  }

  function origem(): HTMLButtonElement {
    return elemento.querySelector('.origem') as HTMLButtonElement;
  }

  function abrir(): void {
    origem().focus();
    origem().click();
    fixture.detectChanges();
  }

  function teclar(alvo: Element, tecla: string, shiftKey = false): void {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, shiftKey, bubbles: true, cancelable: true }));
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

  it('abre como alertdialog com título e mensagem, e o foco em "Cancelar"', () => {
    abrir();

    const dialogo = janela() as HTMLElement;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(elemento.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe(
      'Excluir este ponto?',
    );
    expect(elemento.querySelector(`#${dialogo.getAttribute('aria-describedby')}`)?.textContent?.trim()).toBe(
      'Pão de Açúcar sai da busca.',
    );
    expect(botoes().map((botao) => botao.textContent?.trim())).toEqual(['Cancelar', 'Excluir ponto']);
    expect(document.activeElement).toBe(botoes()[0]);
  });

  it('o botão de confirmar da exclusão é o vermelho', () => {
    abrir();

    expect(botoes()[1].classList).toContain('botao--exclusao');
    expect(botoes()[0].classList).toContain('botao--secundario');
  });

  it('Esc fecha, responde "não" e devolve o foco a quem abriu', fakeAsync(() => {
    abrir();
    teclar(botoes()[0], 'Escape');
    flushMicrotasks();
    expect(fixture.componentInstance.respostas).toEqual([false]);

    tick(SAIDA_MS);
    fixture.detectChanges();
    expect(janela()).toBeNull();
    expect(document.activeElement).toBe(origem());
  }));

  it('Esc fecha mesmo depois de um clique no texto, que tira o foco dos botões', fakeAsync(() => {
    abrir();
    (janela() as HTMLElement).focus();
    expect(document.activeElement).toBe(janela());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flushMicrotasks();
    tick(SAIDA_MS);
    fixture.detectChanges();
    expect(fixture.componentInstance.respostas).toEqual([false]);
    expect(janela()).toBeNull();
    expect(document.activeElement).toBe(origem());
  }));

  it('com o foco fora dos botões, Tab vai ao primeiro e Shift+Tab ao último', () => {
    abrir();
    const [cancelar, confirmar] = botoes();

    (janela() as HTMLElement).focus();
    teclar(janela() as HTMLElement, 'Tab', true);
    expect(document.activeElement).toBe(confirmar);
    (janela() as HTMLElement).focus();
    teclar(janela() as HTMLElement, 'Tab');
    expect(document.activeElement).toBe(cancelar);
  });

  it('num confirmar logo depois do outro, o foco volta a quem abriu o primeiro', fakeAsync(() => {
    const botao = elemento.querySelector('.em-sequencia') as HTMLButtonElement;
    botao.focus();
    botao.click();
    fixture.detectChanges();
    botoes()[1].click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(elemento.querySelector('.dialogo__titulo')?.textContent?.trim()).toBe('Segundo?');
    expect(document.activeElement).toBe(botoes()[0]);

    teclar(botoes()[0], 'Escape');
    flushMicrotasks();
    tick(SAIDA_MS);
    fixture.detectChanges();
    expect(fixture.componentInstance.respostas).toEqual([false]);
    expect(document.activeElement).toBe(botao);
  }));

  it('Tab e Shift+Tab ficam presos entre os botões do diálogo', () => {
    abrir();
    const [cancelar, confirmar] = botoes();

    teclar(cancelar, 'Tab');
    expect(document.activeElement).toBe(confirmar);
    teclar(confirmar, 'Tab');
    expect(document.activeElement).toBe(cancelar);
    teclar(cancelar, 'Tab', true);
    expect(document.activeElement).toBe(confirmar);
  });

  it('confirmar responde "sim"; clicar fora responde "não"', fakeAsync(() => {
    abrir();
    botoes()[1].click();
    flushMicrotasks();
    tick(SAIDA_MS);
    fixture.detectChanges();

    abrir();
    (elemento.querySelector('.dialogo__fundo') as HTMLElement).click();
    flushMicrotasks();
    tick(SAIDA_MS);
    fixture.detectChanges();

    expect(fixture.componentInstance.respostas).toEqual([true, false]);
    expect(janela()).toBeNull();
  }));

  it('fica no centro da tela, com o fundo escurecido cobrindo tudo', () => {
    abrir();
    const caixa = (janela() as HTMLElement).getBoundingClientRect();
    const fundo = (elemento.querySelector('.dialogo__fundo') as HTMLElement).getBoundingClientRect();

    const { clientWidth: largura, clientHeight: altura } = document.documentElement;

    expect(fundo.width).toBe(largura);
    expect(fundo.height).toBe(altura);
    expect(Math.abs(caixa.left + caixa.width / 2 - largura / 2)).toBeLessThan(1);
    expect(Math.abs(caixa.top + caixa.height / 2 - altura / 2)).toBeLessThan(1);
  });
});
