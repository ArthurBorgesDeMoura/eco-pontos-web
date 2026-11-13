import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Navigation, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { ErroApi } from '../../api/erro-api';
import { ContagemDePontos, PaginaDePontos, PontoResumo } from '../../api/modelos';
import { FiltrosDaBusca, PontosService } from '../../api/pontos.service';
import { EstadoDaBuscaService } from './estado-da-busca.service';
import { PaginaPontosComponent } from './pagina-pontos.component';
import { PontosModule } from './pontos.module';

@Component({ template: '' })
class VazioComponent {}

function ponto(idPonto: number, nome: string): PontoResumo {
  return {
    idPonto,
    nome,
    endereco: `Rua ${idPonto}, 10`,
    bairro: { idBairro: 4, nome: 'Centro' },
    materiais: [{ idCategoria: 6, nome: 'Pilhas e baterias' }],
  };
}

const BAIRROS = [
  { idBairro: 2, nome: 'Alto Umuarama' },
  { idBairro: 4, nome: 'Centro' },
];
const CATEGORIAS = [
  {
    idCategoria: 1,
    nome: 'Papel e papelão',
    descricao: 'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
  },
  { idCategoria: 6, nome: 'Pilhas e baterias', descricao: null },
];

function foraDoAr(): Observable<never> {
  return throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
}

const PRIMEIROS = Array.from({ length: 7 }, (_, i) => ponto(i + 1, `Ponto ${i + 1}`));
const SEGUINTES = Array.from({ length: 6 }, (_, i) => ponto(i + 8, `Ponto ${i + 8}`));

describe('PaginaPontosComponent', () => {
  let fixture: ComponentFixture<PaginaPontosComponent>;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let listar: jasmine.Spy<(filtros: FiltrosDaBusca, pagina?: number) => ReturnType<PontosService['listar']>>;
  let router: Router;
  let contar: jasmine.Spy<(bairro: number | null) => ReturnType<PontosService['contar']>>;
  let obter: jasmine.Spy<(rota: string) => Observable<unknown>>;

  function contagem(total: number, quantidades: Record<number, number>): ContagemDePontos {
    return {
      total,
      categorias: [1, 6].map((idCategoria) => ({ idCategoria, quantidade: quantidades[idCategoria] ?? 0 })),
    };
  }

  function pagina(itens: PontoResumo[], numero: number, total = 13): PaginaDePontos {
    return { itens, total, pagina: numero, tamanho: 7 };
  }

  function tituloSemTotal(): { visivel?: string; ouvido?: string } {
    const titulo = elemento.querySelector('.busca__contagem') as HTMLElement;
    return {
      visivel: titulo.querySelector('[aria-hidden="true"]')?.textContent?.trim(),
      ouvido: titulo.querySelector('.so-leitor-de-tela')?.textContent?.trim(),
    };
  }

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function abrirDeNovo(filtros: Record<string, string>): void {
    fixture.destroy();
    listar.calls.reset();
    contar.calls.reset();
    parametros$.next(convertToParamMap(filtros));
    fixture = TestBed.createComponent(PaginaPontosComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function clicarEmTentarDeNovo(): void {
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    parametros$ = new BehaviorSubject(convertToParamMap({}));
    listar = jasmine.createSpy('listar').and.callFake((_filtros: FiltrosDaBusca, numero = 1) =>
      of(numero === 1 ? pagina(PRIMEIROS, 1) : pagina(SEGUINTES, 2)),
    );
    contar = jasmine.createSpy('contar').and.callFake((bairro: number | null) =>
      of(bairro === 2 ? contagem(0, {}) : contagem(13, { 1: 3, 6: 6 })),
    );
    obter = jasmine.createSpy('get').and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));
    await TestBed.configureTestingModule({
      imports: [PontosModule, RouterTestingModule.withRoutes([{ path: 'pontos/:id', component: VazioComponent }])],
      declarations: [VazioComponent],
      providers: [
        { provide: PontosService, useValue: { listar, contar } },
        { provide: ApiService, useValue: { get: obter } },
        { provide: ActivatedRoute, useValue: { queryParamMap: parametros$.asObservable() } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PaginaPontosComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function navegarPor(gatilho: 'popstate' | 'imperative', url: string): void {
    const navegacao = { trigger: gatilho, extractedUrl: router.parseUrl(url) } as unknown as Navigation;
    spyOn(router, 'getCurrentNavigation').and.returnValue(navegacao);
  }

  describe('voltando do detalhe pelo navegador (FE-09)', () => {
    let estado: EstadoDaBuscaService;
    let rolar: jasmine.Spy;

    beforeEach(() => {
      estado = TestBed.inject(EstadoDaBuscaService);
      spyOn(window, 'requestAnimationFrame').and.callFake((quadro: FrameRequestCallback) => {
        quadro(0);
        return 0;
      });
      rolar = spyOn(window, 'scrollTo');
    });

    it('a busca se refaz como estava, sem pedir nada à API: os 13 pontos do "Mostrar mais" e os contadores', () => {
      (elemento.querySelector('.busca__rodape button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(13);
      fixture.destroy();

      for (const espiao of [listar, contar, obter]) {
        espiao.calls.reset();
      }
      navegarPor('popstate', '/');
      fixture = TestBed.createComponent(PaginaPontosComponent);
      elemento = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      expect(listar).not.toHaveBeenCalled();
      expect(contar).not.toHaveBeenCalled();
      expect(obter).not.toHaveBeenCalled();
      expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(13);
      expect(textos('.busca__resumo')).toEqual(['Mostrando 13 de 13 pontos']);
      expect(textos('.busca__materiais .item__contagem')).toEqual(['13', '3', '6']);
      expect(elemento.querySelector('.busca__rodape button')).toBeNull();
    });

    it('a rolagem volta para onde estava, e o foco para a linha do ponto aberto', () => {
      fixture.destroy();
      estado.guardar(0, {
        filtros: { bairro: 4, categoria: null },
        pontos: PRIMEIROS,
        total: 13,
        paginaAtual: 1,
        bairros: BAIRROS,
        categorias: CATEGORIAS,
        contagens: contagem(2, { 6: 1 }),
        rolagem: 640,
        pontoAberto: 3,
      });
      navegarPor('popstate', '/?bairro=4');
      parametros$.next(convertToParamMap({ bairro: '4' }));
      fixture = TestBed.createComponent(PaginaPontosComponent);
      elemento = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      expect(textos('.busca__contagem')).toEqual(['13 pontos em Centro']);
      expect(rolar).toHaveBeenCalledOnceWith(0, 640);
      expect(document.activeElement?.getAttribute('href')).toBe('/pontos/3');
    });

    it('com outros filtros na URL, ou sem ser pelo voltar, a busca começa do zero', () => {
      fixture.destroy();
      const foto = {
        filtros: { bairro: 4, categoria: null },
        pontos: PRIMEIROS.slice(0, 2),
        total: 2,
        paginaAtual: 1,
        bairros: BAIRROS,
        categorias: CATEGORIAS,
        contagens: null,
        rolagem: 0,
        pontoAberto: null,
      };
      estado.guardar(0, foto);
      listar.calls.reset();
      navegarPor('popstate', '/?material=6');
      parametros$.next(convertToParamMap({ material: '6' }));
      fixture = TestBed.createComponent(PaginaPontosComponent);
      fixture.detectChanges();
      expect(listar).toHaveBeenCalledOnceWith({ bairro: null, categoria: 6 }, 1);
    });

    it('um clique no link da busca (não o voltar) também começa do zero', () => {
      fixture.destroy();
      estado.guardar(0, {
        filtros: { bairro: null, categoria: null },
        pontos: PRIMEIROS,
        total: 13,
        paginaAtual: 1,
        bairros: BAIRROS,
        categorias: CATEGORIAS,
        contagens: null,
        rolagem: 0,
        pontoAberto: null,
      });
      listar.calls.reset();
      navegarPor('imperative', '/');
      parametros$.next(convertToParamMap({}));
      fixture = TestBed.createComponent(PaginaPontosComponent);
      fixture.detectChanges();
      expect(listar).toHaveBeenCalledOnceWith({ bairro: null, categoria: null }, 1);
    });

    it('a foto que voltou sem a contagem pede a contagem logo, sem esperar uma troca de filtro', () => {
      fixture.destroy();
      estado.guardar(0, {
        filtros: { bairro: 4, categoria: null },
        pontos: PRIMEIROS.slice(0, 2),
        total: 2,
        paginaAtual: 1,
        bairros: BAIRROS,
        categorias: CATEGORIAS,
        contagens: null,
        rolagem: 0,
        pontoAberto: null,
      });
      contar.calls.reset();
      listar.calls.reset();
      navegarPor('popstate', '/?bairro=4');
      parametros$.next(convertToParamMap({ bairro: '4' }));
      fixture = TestBed.createComponent(PaginaPontosComponent);
      elemento = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      expect(listar).not.toHaveBeenCalled();
      expect(contar).toHaveBeenCalledOnceWith(4);
      expect(textos('.busca__materiais .item__contagem')).toEqual(['13', '3', '6']);
    });

    it('busca com erro, ou ainda carregando, não é guardada', () => {
      listar.and.returnValue(new Subject<PaginaDePontos>());
      parametros$.next(convertToParamMap({ bairro: '4' }));
      fixture.detectChanges();
      fixture.destroy();
      expect(estado.retomar(0, { bairro: 4, categoria: null })).toBeNull();
    });
  });

  it('mostra o título, o total no cabeçalho, as 7 primeiras linhas e o rodapé', () => {
    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Pontos de coleta');
    expect(textos('.busca__contagem')).toEqual(['13 pontos']);
    expect(textos('.busca__ordem')).toEqual(['Ordenados por bairro, de A a Z']);
    expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(7);
    expect(textos('.busca__resumo')).toEqual(['Mostrando 7 de 13 pontos']);
    expect(listar).toHaveBeenCalledOnceWith({ bairro: null, categoria: null }, 1);
  });

  it('cada material mostra quantos pontos o aceitam, e "Todos os materiais" mostra o total', () => {
    expect(textos('.busca__materiais .item__contagem')).toEqual(['13', '3', '6']);
    expect(contar).toHaveBeenCalledOnceWith(null);
  });

  it('escolher "Papel e papelão" muda o cabeçalho e mostra a descrição; o singular usa "aceita"', () => {
    listar.and.returnValue(of(pagina(PRIMEIROS.slice(0, 3), 1, 3)));
    parametros$.next(convertToParamMap({ material: '1' }));
    fixture.detectChanges();
    expect(textos('.busca__contagem')).toEqual(['3 pontos aceitam Papel e papelão']);
    expect(textos('.busca__descricao')).toEqual([
      'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
    ]);
    expect(contar).toHaveBeenCalledTimes(1);

    listar.and.returnValue(of(pagina([ponto(8, 'Casas Bahia')], 1, 1)));
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    fixture.detectChanges();
    expect(textos('.busca__contagem')).toEqual(['1 ponto aceita Pilhas e baterias em Centro']);
    expect(elemento.querySelector('.busca__descricao')).toBeNull();
  });

  it('trocar o bairro busca os contadores de novo e mantém o material', () => {
    parametros$.next(convertToParamMap({ bairro: '2', material: '6' }));
    fixture.detectChanges();

    expect(contar).toHaveBeenCalledWith(2);
    expect(textos('.busca__materiais .item__contagem')).toEqual(['0', '0', '0']);
    expect(listar).toHaveBeenCalledWith({ bairro: 2, categoria: 6 }, 1);
    const pilhas = Array.from(elemento.querySelectorAll('.busca__materiais button')).find((botao) =>
      botao.textContent?.includes('Pilhas'),
    );
    expect(pilhas?.getAttribute('aria-pressed')).toBe('true');
  });

  it('cada linha leva ao detalhe do ponto', () => {
    const link = elemento.querySelector('.busca__lista > li a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/pontos/1');
  });

  it('"Mostrar mais" acrescenta a página seguinte, põe o foco na primeira linha nova e some no fim', () => {
    (elemento.querySelector('.busca__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledWith({ bairro: null, categoria: null }, 2);
    expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(13);
    expect(textos('.busca__resumo')).toEqual(['Mostrando 13 de 13 pontos']);
    expect(elemento.querySelector('.busca__rodape button')).toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('Ponto 8');
  });

  it('enquanto a próxima página chega, "Mostrar mais" não pede de novo', () => {
    const resposta = new Subject<PaginaDePontos>();
    listar.and.returnValue(resposta);
    const botao = elemento.querySelector('.busca__rodape button') as HTMLButtonElement;
    botao.click();
    botao.click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
  });

  it('os filtros da URL viram os parâmetros da busca; um valor inválido vale como "todos"', () => {
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledWith({ bairro: 4, categoria: 6 }, 1);

    parametros$.next(convertToParamMap({ bairro: 'abc', material: '0' }));
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledWith({ bairro: null, categoria: null }, 1);
  });

  it('escolher um material grava na URL, mantendo o bairro', () => {
    const botoes = Array.from(elemento.querySelectorAll<HTMLButtonElement>('.busca__materiais button'));
    botoes.find((botao) => botao.textContent?.includes('Pilhas e baterias'))?.click();

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { material: 6 },
      queryParamsHandling: 'merge',
    }));
  });

  it('erro na busca mostra a mensagem e "Tentar de novo", que busca outra vez', () => {
    listar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'O servidor está fora do ar agora.')));
    parametros$.next(convertToParamMap({ bairro: '4' }));
    fixture.detectChanges();

    expect(textos('[role="alert"] p')).toEqual(['O servidor está fora do ar agora.']);
    listar.and.returnValue(of(pagina(PRIMEIROS.slice(0, 2), 1, 2)));
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(2);
    expect(textos('.busca__contagem')).toEqual(['2 pontos em Centro']);
  });

  it('um "Mostrar mais" que falha e depois dá certo não deixa o erro antigo na tela', () => {
    listar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    const botao = elemento.querySelector('.busca__rodape button') as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();
    expect(elemento.querySelector('[role="alert"]')).not.toBeNull();

    listar.and.returnValue(of(pagina(SEGUINTES, 2)));
    botao.click();
    fixture.detectChanges();
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
    expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(13);
  });

  it('"Tentar de novo" leva o foco ao título dos resultados quando a busca volta', () => {
    listar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    parametros$.next(convertToParamMap({ bairro: '4' }));
    fixture.detectChanges();

    listar.and.returnValue(of(pagina(PRIMEIROS.slice(0, 2), 1, 2)));
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(elemento.querySelector('.busca__contagem'));
  });

  it('trocar de filtro durante o "Tentar de novo" cancela a tentativa: vale a busca mais nova', () => {
    listar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    parametros$.next(convertToParamMap({ bairro: '1' }));
    fixture.detectChanges();

    const tentativa = new Subject<PaginaDePontos>();
    const comFiltro = new Subject<PaginaDePontos>();
    listar.and.returnValues(tentativa, comFiltro);
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    parametros$.next(convertToParamMap({ bairro: '1', material: '6' }));
    comFiltro.next(pagina([ponto(8, 'Casas Bahia')], 1, 1));
    tentativa.next(pagina(PRIMEIROS, 1));
    fixture.detectChanges();

    expect(textos('.busca__lista .linha__nome')).toEqual(['Casas Bahia']);
  });

  it('bairro que não existe sai da URL, sem criar outra entrada no histórico; id grande demais vale como "todos"', () => {
    parametros$.next(convertToParamMap({ bairro: '999' }));
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { bairro: null },
      replaceUrl: true,
    }));

    parametros$.next(convertToParamMap({ bairro: '99999999999999999999' }));
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledWith({ bairro: null, categoria: null }, 1);
  });

  it('Alto Umuarama mostra o estado vazio do D07: contagem com o bairro, frase, orientação e "Sugerir um ponto"', () => {
    listar.and.returnValue(of(pagina([], 1, 0)));
    parametros$.next(convertToParamMap({ bairro: '2' }));
    fixture.detectChanges();

    expect(textos('.busca__contagem')).toEqual(['0 pontos em Alto Umuarama']);
    expect(elemento.querySelector('.busca__ordem')).toBeNull();
    expect(elemento.querySelector('.busca__rodape')).toBeNull();
    expect(textos('.busca__estado-mensagem')).toEqual(['Nenhum ponto de coleta em Alto Umuarama ainda.']);
    expect(textos('.busca__estado-orientacao')).toEqual([
      'Conhece um local onde algum material pode ser descartado? Sugira o ponto para análise.',
    ]);
    const sugerir = elemento.querySelector('.busca__estado a') as HTMLAnchorElement;
    expect(sugerir.textContent?.trim()).toBe('Sugerir um ponto');
    expect(sugerir.getAttribute('href')).toBe('/sugerir');
    expect(textos('.busca__materiais .item__contagem')).toEqual(['0', '0', '0']);
  });

  it('a frase do vazio leva o material e o bairro escolhidos', () => {
    listar.and.returnValue(of(pagina([], 1, 0)));
    const casos: [Record<string, string>, string, string][] = [
      [{ bairro: '4', material: '1' }, 'Nenhum ponto aceita Papel e papelão em Centro ainda.', '0 pontos aceitam Papel e papelão em Centro'],
      [{ material: '1' }, 'Nenhum ponto aceita Papel e papelão ainda.', '0 pontos aceitam Papel e papelão'],
      [{}, 'Nenhum ponto de coleta ainda.', '0 pontos'],
    ];
    for (const [filtros, frase, cabecalho] of casos) {
      parametros$.next(convertToParamMap(filtros));
      fixture.detectChanges();
      expect(textos('.busca__estado-mensagem')).withContext(JSON.stringify(filtros)).toEqual([frase]);
      expect(textos('.busca__contagem')).withContext(JSON.stringify(filtros)).toEqual([cabecalho]);
    }
  });

  it('um só ponto fica no singular, com o bairro', () => {
    listar.and.returnValue(of(pagina([ponto(8, 'Casas Bahia')], 1, 1)));
    parametros$.next(convertToParamMap({ bairro: '4' }));
    fixture.detectChanges();
    expect(textos('.busca__contagem')).toEqual(['1 ponto em Centro']);
    expect(textos('.busca__resumo')).toEqual(['Mostrando 1 de 1 ponto']);
  });

  it('filtro cujo nome ainda não chegou continua no texto, sem nome', () => {
    obter.and.callFake((rota: string) => (rota === 'categorias' ? foraDoAr() : new Subject<unknown>()));
    listar.and.returnValue(of(pagina([], 1, 0)));
    abrirDeNovo({ bairro: '4', material: '1' });

    expect(textos('.busca__contagem')).toEqual(['0 pontos aceitam o material escolhido no bairro escolhido']);
    expect(textos('.busca__estado-mensagem')).toEqual(['Nenhum ponto aceita o material escolhido no bairro escolhido ainda.']);
  });

  it('"Tentar de novo" leva o foco ao título já na busca; se falhar outra vez, ao novo botão', () => {
    listar.and.returnValue(foraDoAr());
    parametros$.next(convertToParamMap({ bairro: '4' }));
    fixture.detectChanges();

    const resposta = new Subject<PaginaDePontos>();
    listar.and.returnValue(resposta);
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(elemento.querySelector('.busca__contagem'));

    resposta.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    fixture.detectChanges();
    expect(document.activeElement).toBe(elemento.querySelector('[role="alert"] button'));

    const seletor = elemento.querySelector('.busca__bairro [role="combobox"]') as HTMLElement;
    seletor.focus();
    listar.and.returnValue(of(pagina(PRIMEIROS.slice(0, 2), 1, 2)));
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(seletor);
  });

  it('numa nova tentativa do "Mostrar mais", o erro antigo some e volta se ela falhar (o leitor de tela anuncia de novo)', () => {
    listar.and.returnValue(foraDoAr());
    const botao = elemento.querySelector('.busca__rodape button') as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();
    expect(textos('.busca__rodape [role="alert"]')).toEqual(['Fora do ar.']);

    const resposta = new Subject<PaginaDePontos>();
    listar.and.returnValue(resposta);
    botao.click();
    fixture.detectChanges();
    expect(elemento.querySelector('.busca__rodape [role="alert"]')).toBeNull();

    resposta.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    fixture.detectChanges();
    expect(textos('.busca__rodape [role="alert"]')).toEqual(['Fora do ar.']);
  });

  it('durante a busca, 7 linhas-esqueleto escondidas do leitor de tela e um traço no lugar do total', () => {
    const resposta = new Subject<PaginaDePontos>();
    listar.and.returnValue(resposta);
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    fixture.detectChanges();

    const lista = elemento.querySelector('.busca__lista') as HTMLElement;
    expect(lista.getAttribute('aria-hidden')).toBe('true');
    expect(lista.querySelectorAll('eco-linha-ponto.linha--esqueleto').length).toBe(7);
    expect(lista.querySelector('a[href]')).toBeNull();
    expect(tituloSemTotal()).toEqual({ visivel: '– pontos aceitam Pilhas e baterias em Centro', ouvido: 'Buscando pontos…' });
    expect(elemento.querySelector('.busca__ordem')).not.toBeNull();
    expect(elemento.querySelector('.busca__rodape')).toBeNull();

    resposta.next(pagina([ponto(8, 'Casas Bahia')], 1, 1));
    fixture.detectChanges();
    expect(elemento.querySelector('.linha--esqueleto')).toBeNull();
    expect(textos('.busca__contagem')).toEqual(['1 ponto aceita Pilhas e baterias em Centro']);
  });

  it('erro na busca troca a lista pela mensagem e "Tentar de novo", sem estado vazio nem esqueleto', () => {
    listar.and.returnValue(foraDoAr());
    parametros$.next(convertToParamMap({ bairro: '2' }));
    fixture.detectChanges();

    expect(textos('[role="alert"] .busca__estado-mensagem')).toEqual(['Fora do ar.']);
    expect(textos('[role="alert"] button')).toEqual(['Tentar de novo']);
    expect(tituloSemTotal()).toEqual({ visivel: '– pontos em Alto Umuarama', ouvido: 'Não foi possível buscar os pontos.' });
    expect(elemento.querySelector('.busca__estado-orientacao')).toBeNull();
    expect(elemento.querySelector('.linha--esqueleto')).toBeNull();
    expect(elemento.querySelector('.busca__ordem')).toBeNull();
  });

  it('se só o "Mostrar mais" falha, a lista fica e o erro aparece no rodapé, junto do botão', () => {
    listar.and.returnValue(foraDoAr());
    (elemento.querySelector('.busca__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(elemento.querySelectorAll('.busca__lista > li').length).toBe(7);
    expect(textos('.busca__rodape [role="alert"]')).toEqual(['Fora do ar.']);
    expect(textos('.busca__rodape button')).toEqual(['Mostrar mais']);
    expect(elemento.querySelector('.busca__estado')).toBeNull();
  });

  it('busca com erro mostra um traço no lugar do total, não "0 pontos"', () => {
    listar.and.returnValue(foraDoAr());
    parametros$.next(convertToParamMap({ material: '1' }));
    fixture.detectChanges();

    expect(tituloSemTotal()).toEqual({ visivel: '– pontos aceitam Papel e papelão', ouvido: 'Não foi possível buscar os pontos.' });
    expect(elemento.querySelector('.busca__rodape')).toBeNull();
  });

  it('materiais que falham ao abrir voltam com "Tentar de novo", com o material da URL escolhido', () => {
    obter.and.callFake((rota: string) => (rota === 'categorias' ? foraDoAr() : of(BAIRROS)));
    listar.and.returnValue(foraDoAr());
    abrirDeNovo({ material: '1' });
    expect(textos('.busca__materiais button .item__nome')).toEqual(['Todos os materiais']);

    obter.and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));
    listar.and.returnValue(of(pagina(PRIMEIROS.slice(0, 3), 1, 3)));
    clicarEmTentarDeNovo();

    expect(textos('.busca__materiais button .item__nome')).toEqual(['Todos os materiais', 'Papel e papelão', 'Pilhas e baterias']);
    expect(textos('.busca__contagem')).toEqual(['3 pontos aceitam Papel e papelão']);
    const papel = elemento.querySelectorAll('.busca__materiais button')[1];
    expect(papel.getAttribute('aria-pressed')).toBe('true');
  });

  it('bairros que falham ao abrir voltam na próxima busca', () => {
    obter.and.callFake((rota: string) => (rota === 'bairros' ? foraDoAr() : of(CATEGORIAS)));
    abrirDeNovo({});
    obter.and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));

    parametros$.next(convertToParamMap({ material: '6' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.opcoesDeBairro.map((opcao) => opcao.rotulo)).toEqual(['Todos os bairros', 'Alto Umuarama', 'Centro']);
  });

  it('com o bairro na URL, o campo diz "Carregando bairros…" até a lista chegar e "Bairros indisponíveis" se ela falhar', async () => {
    const bairros = new Subject<unknown>();
    obter.and.callFake((rota: string) => (rota === 'bairros' ? bairros : of(CATEGORIAS)));
    abrirDeNovo({ bairro: '4' });
    await estabilizar();
    const campo = (): string => textos('.busca__bairro [role="combobox"]')[0];
    expect(campo()).toBe('Carregando bairros…');

    bairros.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    fixture.detectChanges();
    expect(campo()).toBe('Bairros indisponíveis');

    obter.and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    await estabilizar();
    expect(campo()).toBe('Centro');
  });

  it('com o material na URL, o seletor de material diz "Carregando materiais…" até a lista chegar', async () => {
    const categorias = new Subject<unknown>();
    obter.and.callFake((rota: string) => (rota === 'categorias' ? categorias : of(BAIRROS)));
    abrirDeNovo({ material: '1' });
    await estabilizar();
    const seletor = (): string => textos('.busca__material-seletor [role="combobox"]')[0];
    expect(seletor()).toBe('Carregando materiais…');

    categorias.next(CATEGORIAS);
    categorias.complete();
    fixture.detectChanges();
    expect(seletor()).toBe('Papel e papelão (3)');
  });

  it('contadores que falham voltam com "Tentar de novo" e também ao trocar só o material', () => {
    contar.and.returnValue(foraDoAr());
    listar.and.returnValue(foraDoAr());
    abrirDeNovo({});
    expect(elemento.querySelectorAll('.busca__materiais .item__contagem').length).toBe(0);

    contar.and.returnValue(of(contagem(13, { 1: 3, 6: 6 })));
    listar.and.returnValue(of(pagina(PRIMEIROS, 1)));
    clicarEmTentarDeNovo();
    expect(textos('.busca__materiais .item__contagem')).toEqual(['13', '3', '6']);
    expect(fixture.componentInstance.opcoesDeMaterial.map((opcao) => opcao.rotulo)).toEqual([
      'Todos os materiais (13)',
      'Papel e papelão (3)',
      'Pilhas e baterias (6)',
    ]);

    contar.and.returnValue(foraDoAr());
    parametros$.next(convertToParamMap({ bairro: '4' }));
    fixture.detectChanges();
    expect(elemento.querySelectorAll('.busca__materiais .item__contagem').length).toBe(0);

    contar.calls.reset();
    contar.and.returnValue(of(contagem(2, { 6: 1 })));
    parametros$.next(convertToParamMap({ bairro: '4', material: '6' }));
    fixture.detectChanges();
    expect(contar).toHaveBeenCalledOnceWith(4);
    expect(textos('.busca__materiais .item__contagem')).toEqual(['2', '0', '1']);
  });

  it('contagem que deu certo não é pedida de novo ao trocar só o material', () => {
    parametros$.next(convertToParamMap({ material: '6' }));
    fixture.detectChanges();
    parametros$.next(convertToParamMap({ material: '1' }));
    fixture.detectChanges();
    expect(contar).toHaveBeenCalledTimes(1);
  });
});
