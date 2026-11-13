import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { PaginaDeSugestoes, StatusDoPonto, Sugestao } from '../../api/modelos';
import { SugestoesService } from '../../api/sugestoes.service';
import { MinhasSugestoesModule } from './minhas-sugestoes.module';
import { PaginaMinhasSugestoesComponent } from './pagina-minhas-sugestoes.component';

function sugestao(idPonto: number, nome: string, status: StatusDoPonto): Sugestao {
  return {
    idPonto,
    nome,
    endereco: `Rua ${idPonto}, 10`,
    bairro: { idBairro: 9, nome: 'Jardim Brasília' },
    materiais: [
      { idCategoria: 1, nome: 'Papel e papelão' },
      { idCategoria: 2, nome: 'Plástico' },
    ],
    status,
  };
}

const TODAS = [sugestao(16, 'Ecoponto Morumbi', 'PENDENTE'), sugestao(12, 'Parque do Sabiá', 'APROVADO'), sugestao(9, 'Caçamba', 'RECUSADO')];

function pagina(itens: Sugestao[], numero = 1, total = itens.length): PaginaDeSugestoes {
  return { itens, total, pagina: numero, tamanho: 7 };
}

describe('PaginaMinhasSugestoesComponent', () => {
  let fixture: ComponentFixture<PaginaMinhasSugestoesComponent>;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let minhas: jasmine.Spy<(status: StatusDoPonto | null, pagina?: number) => Observable<PaginaDeSugestoes>>;
  let navegar: jasmine.Spy;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function irPara(parametros: Record<string, string>): void {
    parametros$.next(convertToParamMap(parametros));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    parametros$ = new BehaviorSubject(convertToParamMap({}));
    minhas = jasmine
      .createSpy('minhas')
      .and.callFake((status: StatusDoPonto | null) => of(pagina(TODAS.filter((item) => status === null || item.status === status))));
    await TestBed.configureTestingModule({
      imports: [MinhasSugestoesModule, RouterTestingModule],
      providers: [
        { provide: SugestoesService, useValue: { minhas } },
        { provide: ActivatedRoute, useValue: { queryParamMap: parametros$.asObservable() } },
      ],
    }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PaginaMinhasSugestoesComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('mostra o título, o botão de sugerir e as quatro abas da D10', () => {
    expect(textos('h1')).toEqual(['Minhas sugestões']);
    expect(elemento.querySelector('.minhas__sugerir')?.getAttribute('href')).toBe('/sugerir');
    expect(textos('[role="tab"]')).toEqual(['Todas', 'Pendentes', 'Aprovadas', 'Recusadas']);
    expect(elemento.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Todas');
  });

  it('cada sugestão aparece com a etiqueta do status, em texto: Pendente, Aprovada e Recusada', () => {
    expect(minhas).toHaveBeenCalledOnceWith(null, 1);
    expect(textos('eco-tabela .celula__nome')).toEqual(['Ecoponto Morumbi', 'Parque do Sabiá', 'Caçamba']);
    expect(textos('eco-tabela eco-etiqueta-status')).toEqual(['Pendente', 'Aprovada', 'Recusada']);
    expect(textos('eco-tabela td:nth-child(2)')).toEqual(Array(3).fill('Papel e papelão, Plástico'));
    expect(textos('.minhas__cartao eco-etiqueta-status')).toEqual(['Pendente', 'Aprovada', 'Recusada']);
    expect(textos('.tabela__resumo')).toEqual(['Mostrando 3 de 3 sugestões']);
  });

  it('cada aba pede à API só o seu status e mostra só ele', () => {
    irPara({ aba: 'recusadas' });
    expect(minhas).toHaveBeenCalledWith('RECUSADO', 1);
    expect(textos('eco-tabela eco-etiqueta-status')).toEqual(['Recusada']);
    expect(elemento.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Recusadas');

    irPara({ aba: 'pendentes' });
    expect(minhas).toHaveBeenCalledWith('PENDENTE', 1);
    expect(textos('eco-tabela eco-etiqueta-status')).toEqual(['Pendente']);
  });

  it('escolher uma aba grava na URL; Todas tira o parâmetro; valor inválido vale como Todas', () => {
    (elemento.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2]).click();
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { aba: 'aprovadas' } }));

    irPara({ aba: 'aprovadas' });
    (elemento.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0]).click();
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { aba: null } }));

    irPara({ aba: 'qualquer' });
    expect(minhas).toHaveBeenCalledWith(null, 1);
    expect(elemento.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Todas');
  });

  it('uma aba sem itens mostra a sua frase; Todas oferece "Sugerir um ponto"', () => {
    minhas.and.returnValue(of(pagina([])));
    irPara({ aba: 'aprovadas' });
    expect(textos('.minhas__estado-mensagem')).toEqual(['Nenhuma sugestão aprovada ainda.']);
    expect(elemento.querySelector('.minhas__estado a')).toBeNull();
    expect(elemento.querySelector('eco-tabela')).toBeNull();

    irPara({});
    expect(textos('.minhas__estado-mensagem')).toEqual(['Você ainda não sugeriu nenhum ponto.']);
    const sugerir = elemento.querySelector('.minhas__estado a') as HTMLAnchorElement;
    expect(sugerir.textContent?.trim()).toBe('Sugerir um ponto');
    expect(sugerir.getAttribute('href')).toBe('/sugerir');
  });

  it('enquanto carrega, avisa o leitor de tela numa região que já existia; depois, o que chegou', fakeAsync(() => {
    const resposta = new Subject<PaginaDeSugestoes>();
    minhas.and.returnValue(resposta);
    const regiao = elemento.querySelector('[role="status"]') as HTMLElement;
    irPara({ aba: 'pendentes' });
    expect(textos('.minhas__carregando')).toEqual(['Carregando suas sugestões…']);
    expect(elemento.querySelector('eco-tabela')).toBeNull();
    tick();
    fixture.detectChanges();
    expect(elemento.querySelector('[role="status"]')).toBe(regiao);
    expect(regiao.textContent?.trim()).toBe('Carregando suas sugestões…');

    resposta.next(pagina([]));
    tick();
    fixture.detectChanges();
    expect(regiao.textContent?.trim()).toBe('Nenhuma sugestão pendente.');
  }));

  it('com erro, mostra a mensagem e "Tentar de novo", que fica na tela (com o foco) até a resposta', () => {
    minhas.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    irPara({ aba: 'pendentes' });
    expect(textos('.minhas__estado--erro p')).toEqual(['Fora do ar.']);

    const resposta = new Subject<PaginaDeSugestoes>();
    minhas.and.returnValue(resposta);
    const botao = elemento.querySelector('.minhas__estado--erro button') as HTMLButtonElement;
    botao.focus();
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao);
    botao.click();
    expect(minhas).toHaveBeenCalledTimes(3);

    resposta.next(pagina([TODAS[0]]));
    fixture.detectChanges();
    expect(elemento.querySelector('.minhas__estado--erro')).toBeNull();
    expect(textos('eco-tabela .celula__nome')).toEqual(['Ecoponto Morumbi']);
    expect(document.activeElement).toBe(elemento.querySelector('[role="tabpanel"]'));
  });

  it('o mesmo erro de novo, num "Tentar de novo" que falha, é anunciado outra vez', fakeAsync(() => {
    minhas.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    irPara({ aba: 'pendentes' });
    tick();
    fixture.detectChanges();
    const alerta = elemento.querySelector('p[role="alert"]') as HTMLElement;
    expect(alerta.textContent?.trim()).toBe('Fora do ar.');

    (elemento.querySelector('.minhas__estado--erro button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(alerta.textContent?.trim()).toBe('');
    tick();
    fixture.detectChanges();
    expect(alerta.textContent?.trim()).toBe('Fora do ar.');
  }));

  it('trocar de aba descarta a resposta atrasada da aba anterior', () => {
    const pendentes = new Subject<PaginaDeSugestoes>();
    const recusadas = new Subject<PaginaDeSugestoes>();
    minhas.and.returnValues(pendentes, recusadas);
    irPara({ aba: 'pendentes' });
    irPara({ aba: 'recusadas' });
    recusadas.next(pagina([TODAS[2]]));
    pendentes.next(pagina([TODAS[0]]));
    fixture.detectChanges();

    expect(textos('eco-tabela eco-etiqueta-status')).toEqual(['Recusada']);
  });

  it('um "Mostrar mais" em curso é cancelado quando a aba muda', () => {
    const primeiras = Array.from({ length: 7 }, (_, i) => sugestao(20 - i, `Ponto ${20 - i}`, 'APROVADO'));
    const mais = new Subject<PaginaDeSugestoes>();
    minhas.and.callFake((_status, numero = 1) => (numero === 1 ? of(pagina(primeiras, 1, 13)) : mais));
    irPara({ aba: 'aprovadas' });
    (elemento.querySelector('.tabela__rodape button') as HTMLButtonElement).click();

    minhas.and.returnValue(of(pagina([TODAS[0]])));
    irPara({ aba: 'pendentes' });
    mais.next(pagina(primeiras, 2, 13));
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual(['Ecoponto Morumbi']);
  });

  it('no celular, quando a última página chega, o foco vai ao resumo dos cartões', () => {
    const primeiras = Array.from({ length: 7 }, (_, i) => sugestao(20 - i, `Ponto ${20 - i}`, 'APROVADO'));
    const seguintes = Array.from({ length: 6 }, (_, i) => sugestao(13 - i, `Ponto ${13 - i}`, 'APROVADO'));
    minhas.and.callFake((_status, numero = 1) => of(numero === 1 ? pagina(primeiras, 1, 13) : pagina(seguintes, 2, 13)));
    irPara({ aba: 'aprovadas' });
    const celular = elemento.querySelector('.minhas__celular') as HTMLElement;
    spyOn(window, 'getComputedStyle').and.callFake(
      (alvo: Element) => ({ display: alvo === celular ? 'grid' : 'block' }) as CSSStyleDeclaration,
    );
    const botao = elemento.querySelector('.minhas__rodape button') as HTMLButtonElement;
    botao.focus();
    botao.click();
    fixture.detectChanges();

    expect(elemento.querySelector('.minhas__rodape button')).toBeNull();
    expect(document.activeElement).toBe(elemento.querySelector('.minhas__resumo'));
    expect(textos('.minhas__resumo')).toEqual(['Mostrando 13 de 13 sugestões']);
  });

  it('"Mostrar mais" traz a página seguinte da mesma aba', () => {
    const primeiras = Array.from({ length: 7 }, (_, i) => sugestao(20 - i, `Ponto ${20 - i}`, 'APROVADO'));
    const seguintes = Array.from({ length: 6 }, (_, i) => sugestao(13 - i, `Ponto ${13 - i}`, 'APROVADO'));
    minhas.and.callFake((_status, numero = 1) => of(numero === 1 ? pagina(primeiras, 1, 13) : pagina(seguintes, 2, 13)));
    irPara({ aba: 'aprovadas' });
    expect(textos('.tabela__resumo')).toEqual(['Mostrando 7 de 13 sugestões']);

    (elemento.querySelector('.tabela__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(minhas).toHaveBeenCalledWith('APROVADO', 2);
    expect(textos('.tabela__resumo')).toEqual(['Mostrando 13 de 13 sugestões']);
    expect(elemento.querySelectorAll('eco-tabela tbody tr').length).toBe(13);
    expect(textos('.minhas__resumo')).toEqual(['Mostrando 13 de 13 sugestões']);
  });
});
