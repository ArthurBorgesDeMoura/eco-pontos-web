import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CompartilhadoModule } from '../compartilhado.module';
import { OpcaoDoSeletor } from './seletor.component';

const BAIRROS: OpcaoDoSeletor[] = [
  { valor: null, rotulo: 'Todos os bairros' },
  { valor: 1, rotulo: 'Altamira' },
  { valor: 2, rotulo: 'Alto Umuarama' },
  { valor: 3, rotulo: 'Brasil' },
  { valor: 16, rotulo: 'Santa Luzia' },
  { valor: 17, rotulo: 'Santa Mônica' },
  { valor: 20, rotulo: 'Tibery' },
];

@Component({
  template: `
    <eco-seletor rotulo="Bairro" [opcoes]="opcoes" [formControl]="controle"></eco-seletor>
    <button type="button">Depois</button>
  `,
})
class HospedeiroComponent {
  opcoes = BAIRROS;
  controle = new FormControl<number | null>(null);
}

describe('SeletorComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function caixa(): HTMLElement {
    return elemento.querySelector('[role="combobox"]') as HTMLElement;
  }

  function opcoes(): HTMLElement[] {
    return Array.from(elemento.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  function ativa(): string | null {
    const id = caixa().getAttribute('aria-activedescendant');
    return id ? (elemento.querySelector(`#${id}`)?.textContent?.trim() ?? null) : null;
  }

  function teclar(tecla: string): void {
    caixa().dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule, ReactiveFormsModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('fechado, é um combobox com o rótulo e o valor escolhido', () => {
    const rotulos = (caixa().getAttribute('aria-labelledby') ?? '').split(' ');

    expect(caixa().getAttribute('aria-expanded')).toBe('false');
    expect(caixa().tabIndex).toBe(0);
    expect(rotulos.map((id) => elemento.querySelector(`#${id}`)?.textContent?.trim())).toEqual([
      'Bairro',
      'Todos os bairros',
    ]);
    expect(opcoes().length).toBe(0);
  });

  it('a seta para baixo abre o menu na opção escolhida, marcada com o check', () => {
    teclar('ArrowDown');

    expect(caixa().getAttribute('aria-expanded')).toBe('true');
    expect(opcoes().length).toBe(7);
    expect(ativa()).toBe('Todos os bairros');
    expect(opcoes()[0].getAttribute('aria-selected')).toBe('true');
    expect(opcoes()[0].querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#check');
  });

  it('setas, Home e End andam pela lista sem dar a volta; Enter escolhe e fecha', () => {
    teclar('ArrowDown');
    teclar('ArrowDown');
    expect(ativa()).toBe('Altamira');
    teclar('ArrowUp');
    teclar('ArrowUp');
    expect(ativa()).toBe('Todos os bairros');
    teclar('End');
    teclar('ArrowDown');
    expect(ativa()).toBe('Tibery');
    teclar('Home');
    teclar('ArrowDown');
    teclar('ArrowDown');
    teclar('ArrowDown');
    expect(ativa()).toBe('Brasil');

    teclar('Enter');
    expect(fixture.componentInstance.controle.value).toBe(3);
    expect(caixa().getAttribute('aria-expanded')).toBe('false');
    expect(caixa().textContent?.trim()).toBe('Brasil');
  });

  it('Esc fecha sem trocar o valor e o foco continua na caixa', () => {
    caixa().focus();
    teclar('ArrowDown');
    teclar('ArrowDown');
    teclar('Escape');

    expect(caixa().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.controle.value).toBeNull();
    expect(document.activeElement).toBe(caixa());
  });

  it('Enter, Espaço e clique abrem o menu; Esc fecha cada um e devolve o foco à caixa', () => {
    caixa().focus();
    for (const abrir of [() => teclar('Enter'), () => teclar(' '), () => (caixa().click(), fixture.detectChanges())]) {
      abrir();
      expect(caixa().getAttribute('aria-expanded')).toBe('true');
      expect(opcoes().length).toBe(BAIRROS.length);
      teclar('Escape');
      expect(caixa().getAttribute('aria-expanded')).toBe('false');
      expect(elemento.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement).toBe(caixa());
    }
  });

  it('letras buscam pelo começo do rótulo, sem ligar para acento', fakeAsync(() => {
    teclar('s');
    expect(caixa().getAttribute('aria-expanded')).toBe('true');
    expect(ativa()).toBe('Santa Luzia');

    teclar('s');
    expect(ativa()).toBe('Santa Mônica');
    tick(600);

    teclar('t');
    expect(ativa()).toBe('Tibery');
    tick(600);
  }));

  it('clique numa opção escolhe e devolve o foco à caixa', () => {
    caixa().click();
    fixture.detectChanges();
    opcoes()[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value).toBe(1);
    expect(document.activeElement).toBe(caixa());
  });

  it('Tab escolhe a opção ativa e segue para o próximo campo', () => {
    teclar('ArrowDown');
    teclar('ArrowDown');
    teclar('Tab');

    expect(fixture.componentInstance.controle.value).toBe(1);
    expect(caixa().getAttribute('aria-expanded')).toBe('false');
  });

  it('o ponteiro sobre uma opção não muda a ativa, e o Tab não grava o que ele só sobrevoou', () => {
    teclar('ArrowDown');
    opcoes()[3].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    opcoes()[3].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    fixture.detectChanges();
    expect(ativa()).toBe('Todos os bairros');

    teclar('Tab');
    expect(fixture.componentInstance.controle.value).toBeNull();
  });

  it('atalhos com Ctrl, Alt ou Meta não buscam por letra', () => {
    const teclarCom = (tecla: string, modificador: 'ctrlKey' | 'altKey' | 'metaKey'): void => {
      caixa().dispatchEvent(new KeyboardEvent('keydown', { key: tecla, [modificador]: true, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    teclarCom('c', 'ctrlKey');
    teclarCom('a', 'metaKey');
    teclarCom('s', 'altKey');
    expect(caixa().getAttribute('aria-expanded')).toBe('false');

    teclar('ArrowDown');
    teclarCom('t', 'ctrlKey');
    expect(ativa()).toBe('Todos os bairros');
    teclar('Tab');
    expect(fixture.componentInstance.controle.value).toBeNull();
  });

  it('o valor do formulário aparece na caixa', () => {
    fixture.componentInstance.controle.setValue(17);
    fixture.detectChanges();

    expect(caixa().textContent?.trim()).toBe('Santa Mônica');
  });

  it('desabilitado, sai do Tab e não abre', () => {
    fixture.componentInstance.controle.disable();
    fixture.detectChanges();
    teclar('ArrowDown');

    expect(caixa().tabIndex).toBe(-1);
    expect(caixa().getAttribute('aria-disabled')).toBe('true');
    expect(caixa().getAttribute('aria-expanded')).toBe('false');
  });
});
