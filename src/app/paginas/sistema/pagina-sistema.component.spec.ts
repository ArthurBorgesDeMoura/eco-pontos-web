import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { ErroApi } from '../../api/erro-api';
import { BAIRROS } from '../../api/simulacao/respostas/bairros';
import { CATEGORIAS } from '../../api/simulacao/respostas/categorias';
import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import {
  ESTILOS_TEXTO,
  GRUPOS_DE_CORES,
  PaginaSistemaComponent,
  descreverEstiloDeTexto,
  formatarValor,
} from './pagina-sistema.component';

describe('PaginaSistemaComponent', () => {
  let fixture: ComponentFixture<PaginaSistemaComponent>;
  let api: jasmine.SpyObj<ApiService>;

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = Array.from(elemento().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
    if (!encontrado) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return encontrado;
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.callFake(<T>(rota: string) => of((rota === 'bairros' ? BAIRROS : CATEGORIAS) as unknown as T));

    await TestBed.configureTestingModule({
      declarations: [PaginaSistemaComponent],
      imports: [CompartilhadoModule],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginaSistemaComponent);
  });

  it('tem o título e uma seção para cada grupo de tokens', () => {
    fixture.detectChanges();

    expect(elemento().querySelector('h1')?.textContent?.trim()).toBe('Sistema');
    const secoes = Array.from(elemento().querySelectorAll('h2')).map((h2) => h2.textContent?.trim());
    expect(secoes).toEqual(['Cores', 'Texto', 'Medidas', 'Ícones', 'Movimento', 'Conexão com a API']);
  });

  it('lê os valores dos tokens do CSS em vez de repeti-los', () => {
    fixture.detectChanges();
    const valores = fixture.componentInstance.valores;

    expect(valores['cor-fundo-base']).toBe('#F3F4EE');
    expect(valores['cor-texto-secundario']).toBe('#3F4941');
    expect(valores['cor-acao-primaria']).toBe('#161B17');
    expect(valores['espaco-16']).toBe('16px');
    expect(valores['raio-tag']).toBe('4px');
    expect(valores['controle-altura-m']).toBe('36px');
    expect(valores['controle-altura-g']).toBe('44px');
    expect(valores['duracao-dialogo']).toBe('200ms');
    expect(valores['coluna-conteudo']).toBe('1120px');
    expect(valores['margem-tablet']).toBe('32px');
    for (const estilo of ESTILOS_TEXTO) {
      expect(descreverEstiloDeTexto(valores[`texto-${estilo.token}`])).withContext(estilo.rotulo).not.toBe('—');
    }
  });

  it('tem os estilos de texto do quadro Tipografia do Figma', () => {
    fixture.detectChanges();
    const descrever = (token: string): string =>
      descreverEstiloDeTexto(fixture.componentInstance.valores[`texto-${token}`]);

    expect(ESTILOS_TEXTO.length).toBe(14);
    expect(descrever('numero-28')).toBe('28 px / 32 px · peso 600');
    expect(descrever('titulo-22-celular')).toBe('22 px / 28 px · peso 600');
    expect(descrever('corpo-14-medio')).toBe('14 px / 20 px · peso 500');
    expect(descrever('apoio-13')).toBe('13 px / 18 px · peso 400');
    expect(descrever('rotulo-11')).toBe('11 px / 14 px · peso 500');
  });

  it('pinta cada amostra de cor com o token do mesmo nome', () => {
    fixture.detectChanges();
    const amostras = Array.from(elemento().querySelectorAll<HTMLElement>('.cor__amostra'));
    const tokens = GRUPOS_DE_CORES.flatMap((grupo) => grupo.cores.map((cor) => cor.token));
    const referencia = document.createElement('div');
    document.body.appendChild(referencia);

    expect(amostras.length).toBe(tokens.length);
    tokens.forEach((token, i) => {
      referencia.style.backgroundColor = `var(--cor-${token})`;
      expect(getComputedStyle(amostras[i]).backgroundColor)
        .withContext(token)
        .toBe(getComputedStyle(referencia).backgroundColor);
    });
    referencia.remove();
  });

  it('usa algarismos tabulares nos valores, sem o estilo de texto apagá-los', () => {
    fixture.detectChanges();

    for (const seletor of ['.cabecalho__layout', '.cor__valor', '.espaco__valor', '.movimento__valor']) {
      const alvo = elemento().querySelector(seletor) as HTMLElement;
      expect(getComputedStyle(alvo).fontVariantNumeric).withContext(seletor).toBe('tabular-nums');
    }
    expect(getComputedStyle(elemento().querySelector('.cor__valor') as HTMLElement).fontSize).toBe('13px');
  });

  it('lista os bairros e as categorias que a API devolve', () => {
    fixture.detectChanges();

    expect(api.get).toHaveBeenCalledWith('bairros');
    expect(api.get).toHaveBeenCalledWith('categorias');
    const listas = elemento().querySelectorAll('.lista-simples');
    expect(listas[0].querySelectorAll('li').length).toBe(20);
    expect(listas[1].querySelectorAll('li').length).toBe(10);
  });

  it('mostra a mensagem traduzida quando a API falha e tenta de novo', () => {
    api.get.and.returnValue(throwError(() => new ErroApi(504, 'SERVIDOR_INDISPONIVEL', 'O servidor está fora do ar.')));
    fixture.detectChanges();

    expect(elemento().querySelector('.aviso-erro')?.textContent).toContain('O servidor está fora do ar.');

    api.get.and.callFake(<T>(rota: string) => of((rota === 'bairros' ? BAIRROS : CATEGORIAS) as unknown as T));
    botao('Tentar de novo').click();
    fixture.detectChanges();

    expect(elemento().querySelector('.aviso-erro')).toBeNull();
    expect(elemento().querySelectorAll('.lista-simples li').length).toBe(30);
  });

  it('abre o diálogo com o foco dentro dele, fecha com Esc e devolve o foco', fakeAsync(() => {
    fixture.detectChanges();
    botao('Abrir diálogo').click();
    fixture.detectChanges();

    const dialogo = elemento().querySelector<HTMLElement>('[role="dialog"]');
    expect(dialogo).not.toBeNull();
    expect(document.activeElement).toBe(botao('Fechar'));
    expect(elemento().querySelector('main')?.hasAttribute('inert')).toBeTrue();

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialogo?.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(botao('Fechar'));

    expect(dialogo?.getAttribute('tabindex')).toBe('-1');
    dialogo?.focus();
    expect(document.activeElement).toBe(dialogo);

    dialogo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick(400);
    fixture.detectChanges();

    expect(elemento().querySelector('[role="dialog"]')).toBeNull();
    expect(elemento().querySelector('main')?.hasAttribute('inert')).toBeFalse();
    expect(document.activeElement).toBe(botao('Abrir diálogo'));
  }));

  it('empurra a tela de detalhes e, ao voltar, devolve o foco', fakeAsync(() => {
    fixture.detectChanges();
    botao('Abrir detalhes').click();
    fixture.detectChanges();

    expect(elemento().querySelector('[aria-label="Tela de detalhes"]')).not.toBeNull();
    expect(document.activeElement).toBe(botao('Voltar'));

    botao('Voltar').click();
    tick(400);
    fixture.detectChanges();

    expect(elemento().querySelector('[aria-label="Tela de detalhes"]')).toBeNull();
    expect(document.activeElement).toBe(botao('Abrir detalhes'));
  }));
});

describe('formatarValor e descreverEstiloDeTexto', () => {
  it('escrevem as medidas como na interface', () => {
    expect(formatarValor('150ms')).toBe('150 ms');
    expect(formatarValor('16px')).toBe('16 px');
    expect(formatarValor('0.97')).toBe('0,97');
    expect(formatarValor('')).toBe('—');
    expect(descreverEstiloDeTexto('600 24px / 32px "Atkinson Hyperlegible Next", sans-serif')).toBe(
      '24 px / 32 px · peso 600',
    );
    expect(descreverEstiloDeTexto(undefined)).toBe('—');
  });
});
