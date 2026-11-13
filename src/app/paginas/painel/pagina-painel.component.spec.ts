import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { PaginaDeCategorias, PaginaDoPainel, PontoDoPainel, ResumoDoPainel, StatusDoPonto } from '../../api/modelos';
import { Decisao, PainelService } from '../../api/painel.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { MudancasDoPainelService } from './mudancas-do-painel.service';
import { DURACAO_DA_SAIDA_DA_LINHA_MS, PaginaPainelComponent } from './pagina-painel.component';
import { PainelModule } from './painel.module';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

function ponto(idPonto: number, nome: string, extra: Partial<PontoDoPainel> = {}): PontoDoPainel {
  return {
    idPonto,
    nome,
    endereco: `Rua ${idPonto}, 10`,
    bairro: { idBairro: 7, nome: 'Daniel Fonseca' },
    materiais: [
      { idCategoria: 1, nome: 'Papel e papelão' },
      { idCategoria: 2, nome: 'Plástico' },
    ],
    horario: null,
    contato: null,
    status: 'PENDENTE',
    sugeridoPor: { idUsuario: 3, nome: 'João Pereira' },
    ...extra,
  };
}

const DANIEL = ponto(14, 'Ecoponto Daniel Fonseca', { horario: '7h às 19h, todos os dias' });
const CORU = ponto(15, 'Cooperativa dos Recicladores de Uberlândia (CORU)', {
  contato: '(34) 99798-1494',
  sugeridoPor: { idUsuario: 2, nome: 'Maria Souza' },
});

function pagina(itens: PontoDoPainel[], numero = 1, total = itens.length): PaginaDoPainel {
  return { itens, total, pagina: numero, tamanho: 7 };
}

describe('PaginaPainelComponent', () => {
  let fixture: ComponentFixture<PaginaPainelComponent>;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let resumo: jasmine.Spy<() => Observable<ResumoDoPainel>>;
  let pontos: jasmine.Spy<(status?: StatusDoPonto, pagina?: number, tamanho?: number) => Observable<PaginaDoPainel>>;
  let decidir: jasmine.Spy<(id: number, decisao: Decisao) => Observable<PontoDoPainel>>;
  let categorias: jasmine.Spy<() => Observable<PaginaDeCategorias>>;
  let mostrarAviso: jasmine.Spy;
  let navegar: jasmine.Spy;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function botao(idPonto: number, decisao: Decisao): HTMLButtonElement {
    const botoes = Array.from(
      elemento.querySelectorAll<HTMLButtonElement>(`[data-ponto="${idPonto}"][data-decisao="${decisao}"]`),
    );
    return botoes.find((item) => item.getClientRects().length > 0) ?? botoes[0];
  }

  function criar(): void {
    fixture = TestBed.createComponent(PaginaPainelComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    parametros$ = new BehaviorSubject(convertToParamMap({}));
    resumo = jasmine.createSpy('resumo').and.returnValue(of({ pendentes: 2, pontos: 13, categorias: 10 }));
    pontos = jasmine.createSpy('pontos').and.returnValue(of(pagina([DANIEL, CORU])));
    decidir = jasmine.createSpy('decidir').and.callFake((id: number, decisao: Decisao) =>
      of({ ...(id === 14 ? DANIEL : CORU), status: decisao === 'aprovar' ? 'APROVADO' : 'RECUSADO' } as PontoDoPainel),
    );
    categorias = jasmine.createSpy('categorias').and.returnValue(
      of({
        itens: [
          { idCategoria: 1, nome: 'Papel e papelão', descricao: null, pontos: 3 },
          { idCategoria: 2, nome: 'Plástico', descricao: null, pontos: 3 },
        ],
        total: 2,
        pagina: 1,
        tamanho: 50,
      } as PaginaDeCategorias),
    );
    await TestBed.configureTestingModule({
      imports: [PainelModule, RouterTestingModule],
      providers: [
        { provide: PainelService, useValue: { resumo, pontos, decidir, categorias } },
        { provide: ActivatedRoute, useValue: { queryParamMap: parametros$.asObservable() } },
      ],
    }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    mostrarAviso = spyOn(TestBed.inject(AvisoService), 'mostrar');
  });

  it('mostra o título e as abas Pendentes, Pontos e Categorias com os contadores do resumo', () => {
    criar();
    expect(textos('h1')).toEqual(['Painel de administração']);
    expect(resumo).toHaveBeenCalledTimes(1);
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['2', '13', '10']);
    expect(textos('[role="tab"] .so-leitor-de-tela')).toEqual(['(2)', '(13)', '(10)']);
    expect(elemento.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Pendentes');
  });

  it('pede a fila PENDENTE e monta a tabela com Ponto, Materiais, Sugerido por e Ações', () => {
    criar();
    expect(pontos).toHaveBeenCalledOnceWith('PENDENTE', 1, 7);
    expect(textos('eco-tabela thead th')).toEqual(['Ponto', 'Materiais', 'Sugerido por', 'Ações']);
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
    expect(textos('eco-tabela .celula__local')).toEqual(['Daniel Fonseca · Rua 14, 10', 'Daniel Fonseca · Rua 15, 10']);
    expect(textos('eco-tabela .celula__detalhe')).toEqual([
      'Horário: 7h às 19h, todos os dias · Contato: não informado',
      'Horário: não informado · Contato: (34) 99798-1494',
    ]);
    expect(textos('eco-tabela td:nth-child(2)')).toEqual(Array(2).fill('Papel e papelão, Plástico'));
    expect(textos('eco-tabela .painel__autor')).toEqual(['João Pereira', 'Maria Souza']);
    expect(textos('.tabela__resumo')).toEqual(['2 sugestões aguardando análise']);
    expect(textos('.painel__resumo')).toEqual(['2 sugestões aguardando análise']);
    expect(textos('eco-tabela td:nth-child(4) button')).toEqual([
      `Recusar ${DANIEL.nome}`,
      `Aprovar ${DANIEL.nome}`,
      `Recusar ${CORU.nome}`,
      `Aprovar ${CORU.nome}`,
    ]);
  });

  it('com 1 pendente, o rodapé fica no singular', () => {
    pontos.and.returnValue(of(pagina([CORU])));
    resumo.and.returnValue(of({ pendentes: 1, pontos: 13, categorias: 10 }));
    criar();
    expect(textos('.tabela__resumo')).toEqual(['1 sugestão aguardando análise']);
  });

  it('durante a chamada, os dois botões da linha ficam indisponíveis (com o foco) e um segundo clique não decide de novo', () => {
    const resposta = new Subject<PontoDoPainel>();
    decidir.and.returnValue(resposta);
    criar();
    const aprovar = botao(14, 'aprovar');
    aprovar.focus();
    aprovar.click();
    fixture.detectChanges();

    for (const decisao of ['aprovar', 'recusar'] as const) {
      elemento.querySelectorAll(`[data-ponto="14"][data-decisao="${decisao}"]`).forEach((item) => {
        expect(item.getAttribute('aria-disabled')).withContext(decisao).toBe('true');
        expect(item.hasAttribute('disabled')).toBeFalse();
      });
    }
    expect(botao(15, 'aprovar').getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(aprovar);

    aprovar.click();
    botao(14, 'recusar').click();
    expect(decidir).toHaveBeenCalledOnceWith(14, 'aprovar');
  });

  it('aprovar: o aviso diz "<nome> aprovado e publicado.", a linha esmaece por 160 ms e sai, e os contadores mudam', fakeAsync(() => {
    criar();
    resumo.and.returnValue(of({ pendentes: 1, pontos: 14, categorias: 10 }));
    const aprovar = botao(14, 'aprovar');
    aprovar.focus();
    aprovar.click();
    fixture.detectChanges();

    expect(decidir).toHaveBeenCalledOnceWith(14, 'aprovar');
    expect(mostrarAviso).toHaveBeenCalledOnceWith('Ecoponto Daniel Fonseca aprovado e publicado.');
    expect(elemento.querySelectorAll('.tabela__linha--saindo').length).toBe(1);
    expect(elemento.querySelectorAll('.painel__cartao--saindo').length).toBe(1);
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
    expect(resumo).toHaveBeenCalledTimes(2);
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['1', '14', '10']);

    tick(DURACAO_DA_SAIDA_DA_LINHA_MS - 1);
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
    tick(1);
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([CORU.nome]);
    expect(textos('.painel__cartao .painel__nome')).toEqual([CORU.nome]);
    expect(textos('.tabela__resumo')).toEqual(['1 sugestão aguardando análise']);
    expect(document.activeElement?.getAttribute('data-ponto')).toBe('15');
    expect(document.activeElement?.getAttribute('data-decisao')).toBe('aprovar');
    flush();
  }));

  it('recusar: o aviso diz "<nome> recusado."; a última linha leva o foco à frase do estado vazio', fakeAsync(() => {
    pontos.and.returnValue(of(pagina([CORU])));
    criar();
    resumo.and.returnValue(of({ pendentes: 0, pontos: 13, categorias: 10 }));
    const recusar = botao(15, 'recusar');
    recusar.focus();
    recusar.click();
    fixture.detectChanges();
    expect(decidir).toHaveBeenCalledOnceWith(15, 'recusar');
    expect(mostrarAviso).toHaveBeenCalledOnceWith(`${CORU.nome} recusado.`);

    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(elemento.querySelector('eco-tabela')).toBeNull();
    expect(textos('.painel__estado-mensagem')).toEqual(['Nenhuma sugestão aguardando análise']);
    expect(document.activeElement).toBe(elemento.querySelector('.painel__estado-mensagem'));
    flush();
  }));

  it('409 (outro administrador já decidiu): tira a linha e avisa "Esta sugestão já foi analisada."', fakeAsync(() => {
    decidir.and.returnValue(throwError(() => new ErroApi(409, 'JA_ANALISADO', 'Esta sugestão já foi analisada.')));
    criar();
    botao(14, 'aprovar').click();
    fixture.detectChanges();
    expect(mostrarAviso).toHaveBeenCalledOnceWith('Esta sugestão já foi analisada.');
    expect(resumo).toHaveBeenCalledTimes(2);
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([CORU.nome]);
    flush();
  }));

  it('outro erro: o aviso traz a mensagem, a linha fica e os botões voltam a responder', fakeAsync(() => {
    decidir.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    botao(14, 'aprovar').click();
    fixture.detectChanges();
    expect(mostrarAviso).toHaveBeenCalledOnceWith('Fora do ar.');
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
    expect(botao(14, 'aprovar').getAttribute('aria-disabled')).toBeNull();
    expect(resumo).toHaveBeenCalledTimes(1);

    decidir.and.returnValue(of({ ...DANIEL, status: 'APROVADO' }));
    botao(14, 'aprovar').click();
    expect(decidir).toHaveBeenCalledTimes(2);
    flush();
  }));

  it('401: não mostra aviso (a tela vai para Entrar com o dela) e a linha fica', fakeAsync(() => {
    decidir.and.returnValue(throwError(() => new ErroApi(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.')));
    criar();
    botao(14, 'aprovar').click();
    fixture.detectChanges();
    expect(mostrarAviso).not.toHaveBeenCalled();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
    flush();
  }));

  it('sem pendentes, mostra "Nenhuma sugestão aguardando análise", sem tabela', () => {
    pontos.and.returnValue(of(pagina([])));
    criar();
    expect(textos('.painel__estado-mensagem')).toEqual(['Nenhuma sugestão aguardando análise']);
    expect(elemento.querySelector('eco-tabela')).toBeNull();
  });

  it('enquanto carrega, avisa; com erro, mostra a mensagem e "Tentar de novo"', fakeAsync(() => {
    const resposta = new Subject<PaginaDoPainel>();
    pontos.and.returnValue(resposta);
    criar();
    expect(textos('.painel__carregando')).toEqual(['Carregando as sugestões…']);
    resposta.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(textos('.painel__estado--erro p')).toEqual(['Fora do ar.']);
    expect(textos('p[role="alert"]')).toEqual(['Fora do ar.']);

    pontos.and.returnValue(of(pagina([DANIEL])));
    (elemento.querySelector('.painel__estado--erro button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome]);
    expect(document.activeElement).toBe(elemento.querySelector('[role="tabpanel"]'));
    flush();
  }));

  it('a aba Pontos mostra os aprovados (FE-13); Categorias, as categorias (FE-14); a aba vai para a URL', () => {
    criar();
    expect(elemento.querySelector('[data-acao="nova-categoria"]')).toBeNull();
    const bretas = ponto(4, 'Bretas - Loja 518', { status: 'APROVADO' });
    pontos.and.returnValue(of(pagina([bretas], 1, 13)));
    parametros$.next(convertToParamMap({ aba: 'pontos' }));
    fixture.detectChanges();
    expect(pontos).toHaveBeenCalledWith('APROVADO', 1, 7);
    expect(textos('eco-painel-pontos .painel__cartao .painel__nome')).toEqual(['Bretas - Loja 518']);
    expect(textos('eco-painel-pontos .painel__resumo')).toEqual(['Mostrando 1 de 13 pontos']);
    expect(textos('eco-tabela .celula__nome')).toEqual(['Bretas - Loja 518']);
    parametros$.next(convertToParamMap({ aba: 'categorias' }));
    fixture.detectChanges();
    expect(elemento.querySelector('eco-painel-pontos')).toBeNull();
    expect(categorias).toHaveBeenCalledTimes(1);
    expect(textos('eco-painel-categorias .painel__cartao .painel__nome')).toEqual(['Papel e papelão', 'Plástico']);
    expect(textos('.painel__estado-mensagem')).toEqual([]);
    expect(pontos).toHaveBeenCalledTimes(2);
    const nova = elemento.querySelector('[data-acao="nova-categoria"]');
    expect(nova?.textContent?.trim()).toBe('Nova categoria');
    expect(nova?.getAttribute('href')).toBe('/painel/categorias/nova');

    (elemento.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0]).click();
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { aba: null } }));
    (elemento.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]).click();
    expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { aba: 'pontos' } }));
  });

  it('a cada troca de aba, os contadores vêm de novo (uma exclusão pode ter terminado com a aba fora)', () => {
    criar();
    expect(resumo).toHaveBeenCalledTimes(1);
    resumo.and.returnValue(of({ pendentes: 2, pontos: 12, categorias: 10 }));
    parametros$.next(convertToParamMap({ aba: 'categorias' }));
    fixture.detectChanges();
    expect(resumo).toHaveBeenCalledTimes(2);
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['2', '12', '10']);
    parametros$.next(convertToParamMap({ aba: 'categorias' }));
    expect(resumo).toHaveBeenCalledTimes(2);
  });

  it('excluído um ponto na aba Pontos, o contador cai na hora e o resumo vem de novo; se ele falhar, fica o número de cá', () => {
    parametros$.next(convertToParamMap({ aba: 'pontos' }));
    criar();
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['2', '13', '10']);
    resumo.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    TestBed.inject(MudancasDoPainelService).avisarExclusao();
    fixture.detectChanges();
    expect(resumo).toHaveBeenCalledTimes(2);
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['2', '12', '10']);
  });

  it('uma exclusão que termina depois de trocar de aba ainda corrige o contador de Pontos', () => {
    parametros$.next(convertToParamMap({ aba: 'pontos' }));
    criar();
    parametros$.next(convertToParamMap({}));
    fixture.detectChanges();
    expect(elemento.querySelector('eco-painel-pontos')).toBeNull();
    resumo.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    TestBed.inject(MudancasDoPainelService).avisarExclusao();
    fixture.detectChanges();
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['2', '12', '10']);
  });

  it('"Nova categoria" guarda a aba; quem cancela a categoria nova volta com o foco no "Nova categoria"', () => {
    parametros$.next(convertToParamMap({ aba: 'categorias' }));
    criar();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    (elemento.querySelector('[data-acao="nova-categoria"]') as HTMLElement).click();
    const retornos = TestBed.inject(RetornoDaEdicaoService);
    expect(retornos.retomar(0, 'categorias')).toEqual({ aba: 'categorias', carregados: 0, id: null });

    fixture.destroy();
    retornos.guardar(0, { aba: 'categorias', carregados: 0, id: null });
    criar();
    expect(document.activeElement).toBe(elemento.querySelector('[data-acao="nova-categoria"]'));
  });

  it('na volta da edição, se o ponto editado saiu da parte carregada (outro bairro), o foco vai ao painel da aba', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(0, { aba: 'pontos', carregados: 7, id: 99 });
    pontos.and.returnValue(of(pagina([ponto(4, 'Bretas - Loja 518', { status: 'APROVADO' })], 1, 13)));
    parametros$.next(convertToParamMap({ aba: 'pontos' }));
    criar();
    expect(document.activeElement).toBe(elemento.querySelector('[role="tabpanel"]'));
  });

  it('"Mostrar mais" pede de novo desde o começo, com 7 a mais, e troca a lista: nenhum pendente fica de fora', () => {
    const fila = Array.from({ length: 10 }, (_, i) => ponto(i + 1, `Ponto ${i + 1}`));
    pontos.and.returnValue(of(pagina(fila.slice(0, 7), 1, 10)));
    resumo.and.returnValue(of({ pendentes: 10, pontos: 13, categorias: 10 }));
    criar();

    const andou = fila.filter((item) => item.idPonto !== 2 && item.idPonto !== 3);
    pontos.and.returnValue(of(pagina(andou, 1, 8)));
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pontos).toHaveBeenCalledWith('PENDENTE', 1, 14);
    expect(textos('.painel__cartao .painel__nome')).toEqual(andou.map((item) => item.nome));
    expect(textos('.painel__resumo')).toEqual(['8 sugestões aguardando análise']);
    expect(elemento.querySelector('.painel__rodape button')).toBeNull();
  });

  it('"Mostrar mais" espera enquanto uma decisão está em curso', () => {
    const fila = Array.from({ length: 7 }, (_, i) => ponto(i + 1, `Ponto ${i + 1}`));
    pontos.and.returnValue(of(pagina(fila, 1, 9)));
    resumo.and.returnValue(of({ pendentes: 9, pontos: 13, categorias: 10 }));
    decidir.and.returnValue(new Subject<PontoDoPainel>());
    criar();
    botao(1, 'aprovar').click();
    fixture.detectChanges();

    const mais = elemento.querySelector('.painel__rodape button') as HTMLButtonElement;
    expect(mais.getAttribute('aria-disabled')).toBe('true');
    expect(elemento.querySelector('.tabela__rodape button')?.getAttribute('aria-disabled')).toBe('true');
    mais.click();
    expect(pontos).toHaveBeenCalledTimes(1);
  });

  it('decididas as últimas linhas da página, busca a fila de novo sem passar pelo estado vazio, e o foco volta ao painel', fakeAsync(() => {
    pontos.and.returnValue(of(pagina([DANIEL], 1, 2)));
    criar();
    resumo.and.returnValue(of({ pendentes: 1, pontos: 14, categorias: 10 }));
    const aprovar = botao(14, 'aprovar');
    aprovar.focus();
    aprovar.click();
    fixture.detectChanges();

    pontos.and.returnValue(of(pagina([CORU])));
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(pontos).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('.painel__estado-mensagem')).toBeNull();
    expect(textos('eco-tabela .celula__nome')).toEqual([CORU.nome]);
    expect(document.activeElement).toBe(elemento.querySelector('[role="tabpanel"]'));
    flush();
  }));

  it('com a fila vazia, um resumo com pendentes busca a fila de novo (chegou sugestão nova)', () => {
    pontos.and.returnValues(of(pagina([])), of(pagina([CORU])));
    resumo.and.returnValue(of({ pendentes: 1, pontos: 13, categorias: 10 }));
    criar();
    expect(pontos).toHaveBeenCalledTimes(2);
    expect(textos('eco-tabela .celula__nome')).toEqual([CORU.nome]);
    expect(textos('.tabela__resumo')).toEqual(['1 sugestão aguardando análise']);
  });

  it('os contadores mudam na hora da decisão; se o resumo seguinte falhar, ficam assim', () => {
    criar();
    resumo.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    botao(14, 'aprovar').click();
    fixture.detectChanges();
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['1', '14', '10']);
    botao(15, 'recusar').click();
    fixture.detectChanges();
    expect(textos('[role="tab"] .abas__contagem')).toEqual(['0', '14', '10']);
  });

  it('um item sem "sugeridoPor" ou sem bairro (formato ainda provisório) não derruba a tela', () => {
    const torto = { ...CORU, sugeridoPor: null, bairro: null, materiais: undefined } as unknown as PontoDoPainel;
    pontos.and.returnValue(of(pagina([torto])));
    resumo.and.returnValue(of({ pendentes: 1, pontos: 13, categorias: 10 }));
    criar();
    expect(textos('eco-tabela .painel__autor')).toEqual(['Não informado']);
    expect(textos('eco-tabela .celula__local')).toEqual(['Rua 15, 10']);
    expect(textos('.painel__cartao .painel__local')).toEqual(['Rua 15, 10']);
  });

  it('se o resumo falhar, as abas ficam sem números e a fila aparece', () => {
    resumo.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    expect(elemento.querySelectorAll('.abas__contagem').length).toBe(0);
    expect(textos('eco-tabela .celula__nome')).toEqual([DANIEL.nome, CORU.nome]);
  });
});
