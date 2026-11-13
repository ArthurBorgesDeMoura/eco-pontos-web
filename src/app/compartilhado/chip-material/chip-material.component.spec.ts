import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChipMaterialComponent } from './chip-material.component';

describe('ChipMaterialComponent', () => {
  let fixture: ComponentFixture<ChipMaterialComponent>;
  let chip: ChipMaterialComponent;
  let emitidos: boolean[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [ChipMaterialComponent] }).compileComponents();
    fixture = TestBed.createComponent(ChipMaterialComponent);
    chip = fixture.componentInstance;
    chip.rotulo = 'Plástico';
    emitidos = [];
    chip.ligadoChange.subscribe((ligado) => emitidos.push(ligado));
  });

  it('no filtro, é um botão que liga e desliga com aria-pressed', () => {
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    expect(botao.textContent?.trim()).toBe('Plástico');
    expect(botao.type).toBe('button');
    expect(botao.getAttribute('aria-pressed')).toBe('false');

    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-pressed')).toBe('true');
    expect(botao.classList).toContain('chip--ligado');

    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-pressed')).toBe('false');
    expect(emitidos).toEqual([true, false]);
  });

  it('no formulário, é uma caixa de seleção nativa com o rótulo ligado a ela', () => {
    chip.variante = 'formulario';
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const caixa = elemento.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const rotulo = elemento.querySelector('label') as HTMLLabelElement;
    expect(rotulo.htmlFor).toBe(caixa.id);
    expect(caixa.checked).toBeFalse();

    rotulo.click();
    fixture.detectChanges();
    expect(caixa.checked).toBeTrue();
    expect(rotulo.classList).toContain('chip--ligado');
    expect(emitidos).toEqual([true]);
  });

  it('desabilitado, não muda', () => {
    chip.desabilitado = true;
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    botao.click();
    chip.alternar();
    expect(botao.disabled).toBeTrue();
    expect(emitidos).toEqual([]);
  });

  it('ligado não muda de largura: a borda continua, só muda de cor', () => {
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    const desligado = botao.getBoundingClientRect().width;

    botao.click();
    fixture.detectChanges();
    expect(botao.getBoundingClientRect().width).toBe(desligado);
  });
});
