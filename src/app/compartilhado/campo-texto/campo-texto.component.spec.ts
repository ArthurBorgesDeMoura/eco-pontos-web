import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CompartilhadoModule } from '../compartilhado.module';

@Component({
  template: `
    <eco-campo-texto
      rotulo="Nome do ponto"
      marcador="Digite aqui"
      [ajuda]="ajuda"
      [erro]="erro"
      [maximo]="120"
      [formControl]="controle"
    ></eco-campo-texto>
  `,
})
class HospedeiroComponent {
  controle = new FormControl('', { nonNullable: true });
  ajuda: string | null = 'Até 120 caracteres.';
  erro: string | null = null;
}

describe('CampoTextoComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function entrada(): HTMLInputElement {
    return elemento.querySelector('input') as HTMLInputElement;
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

  it('liga o rótulo ao campo e mostra o marcador', () => {
    const rotulo = elemento.querySelector('label') as HTMLLabelElement;

    expect(rotulo.textContent?.trim()).toBe('Nome do ponto');
    expect(rotulo.htmlFor).toBe(entrada().id);
    expect(entrada().placeholder).toBe('Digite aqui');
    expect(entrada().maxLength).toBe(120);
  });

  it('liga a ajuda ao campo por aria-describedby', () => {
    const ajuda = elemento.querySelector('.campo__ajuda') as HTMLElement;

    expect(ajuda.textContent?.trim()).toBe('Até 120 caracteres.');
    expect(entrada().getAttribute('aria-describedby')).toBe(ajuda.id);
    expect(entrada().hasAttribute('aria-invalid')).toBeFalse();
  });

  it('com erro, troca a ajuda pelo erro e marca o campo como inválido', () => {
    fixture.componentInstance.erro = 'Informe o nome do ponto.';
    fixture.detectChanges();
    const erro = elemento.querySelector('.campo__erro') as HTMLElement;

    expect(erro.textContent?.trim()).toBe('Informe o nome do ponto.');
    expect(elemento.querySelector('.campo__ajuda')).toBeNull();
    expect(entrada().getAttribute('aria-describedby')).toBe(erro.id);
    expect(entrada().getAttribute('aria-invalid')).toBe('true');
  });

  it('funciona com formulários do Angular nos dois sentidos', () => {
    fixture.componentInstance.controle.setValue('Ecoponto Luizote');
    fixture.detectChanges();
    expect(entrada().value).toBe('Ecoponto Luizote');

    entrada().value = 'Pão de Açúcar';
    entrada().dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.controle.value).toBe('Pão de Açúcar');

    entrada().dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.controle.touched).toBeTrue();
  });

  it('desabilitado pelo formulário, não aceita texto', () => {
    fixture.componentInstance.controle.disable();
    fixture.detectChanges();

    expect(entrada().disabled).toBeTrue();
    expect(elemento.querySelector('.campo__caixa')?.classList).toContain('campo__caixa--desabilitada');
  });

  it('tem a caixa de 40 px do Figma', () => {
    expect((elemento.querySelector('.campo__caixa') as HTMLElement).getBoundingClientRect().height).toBe(40);
  });
});
