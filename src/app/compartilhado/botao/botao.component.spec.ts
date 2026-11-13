import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { EstadoForcado, TamanhoBotao, TipoBotao } from './botao.component';

@Component({
  template: `
    <button
      eco-botao
      type="button"
      [tipo]="tipo"
      [tamanho]="tamanho"
      [iconeExterno]="externo"
      [estadoForcado]="estado"
      [disabled]="desabilitado"
      (click)="cliques = cliques + 1"
    >
      Entrar
    </button>
    <a eco-botao tipo="secundario" tamanho="p" [iconeExterno]="true" href="https://example.com">Abrir no mapa</a>
  `,
})
class HospedeiroComponent {
  tipo: TipoBotao = 'primario';
  tamanho: TamanhoBotao = 'm';
  externo = false;
  estado: EstadoForcado = null;
  desabilitado = false;
  cliques = 0;
}

describe('BotaoComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;

  function botao(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  function link(): HTMLAnchorElement {
    return (fixture.nativeElement as HTMLElement).querySelector('a') as HTMLAnchorElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    fixture.detectChanges();
  });

  it('fica no próprio <button>, com o texto e as classes de tipo e tamanho', () => {
    expect(botao().textContent?.trim()).toBe('Entrar');
    expect(botao().classList).toContain('botao--primario');
    expect(botao().classList).toContain('botao--m');

    fixture.componentInstance.tipo = 'exclusao';
    fixture.componentInstance.tamanho = 'g';
    fixture.detectChanges();
    expect(botao().classList).toContain('botao--exclusao');
    expect(botao().classList).toContain('botao--g');
  });

  it('tem as alturas do Figma: P 32, M 36 e G 44 px', () => {
    const alturas: Record<TamanhoBotao, number> = { p: 32, m: 36, g: 44 };
    for (const tamanho of ['p', 'm', 'g'] as const) {
      fixture.componentInstance.tamanho = tamanho;
      fixture.detectChanges();
      expect(botao().getBoundingClientRect().height).withContext(tamanho).toBe(alturas[tamanho]);
    }
  });

  it('mostra a seta diagonal depois do rótulo, com 14 px no P e 16 px nos outros', () => {
    expect(botao().querySelector('eco-icone')).toBeNull();

    fixture.componentInstance.externo = true;
    fixture.detectChanges();
    expect(botao().querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#seta-diagonal');
    expect(botao().querySelector('svg')?.classList).toContain('icone--16');
    expect(link().querySelector('svg')?.classList).toContain('icone--14');
  });

  it('desabilitado, não recebe clique', () => {
    fixture.componentInstance.desabilitado = true;
    fixture.detectChanges();

    botao().click();
    expect(botao().disabled).toBeTrue();
    expect(fixture.componentInstance.cliques).toBe(0);
  });

  it('marca o estado forçado só para o catálogo', () => {
    fixture.componentInstance.estado = 'hover';
    fixture.detectChanges();
    expect(botao().classList).toContain('botao--forcar-hover');
  });

  it('também funciona num link, que segue sendo link', () => {
    expect(link().getAttribute('href')).toBe('https://example.com');
    expect(link().classList).toContain('botao--secundario');
    expect(link().classList).toContain('botao--p');
  });
});
