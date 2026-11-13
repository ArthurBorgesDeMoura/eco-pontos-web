import { ComponentFixture, TestBed, fakeAsync, flush, flushMicrotasks, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { PaginaDoPainel, PontoDoPainel, StatusDoPonto } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { DialogoService } from '../../compartilhado/dialogo/dialogo.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { DURACAO_DA_SAIDA_DA_LINHA_MS } from './apoio';
import { MudancasDoPainelService } from './mudancas-do-painel.service';
import { MENSAGEM_DOS_PONTOS, PainelPontosComponent } from './painel-pontos.component';
import { PainelModule } from './painel.module';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

function ponto(idPonto: number, nome: string, bairro: string): PontoDoPainel {
  return {
    idPonto,
    nome,
    endereco: `Rua ${idPonto}, 10`,
    bairro: { idBairro: idPonto, nome: bairro },
    materiais: [{ idCategoria: 6, nome: 'Pilhas e baterias' }],
    horario: null,
    contato: null,
    status: 'APROVADO',
    sugeridoPor: { idUsuario: 1, nome: 'Administrador EcoPonto' },
  };
}

const APROVADOS: PontoDoPainel[] = [
  ponto(2, 'Drogaria São Paulo - DSP Uberlândia III', 'Altamira'),
  ponto(10, 'Pão de Açúcar', 'Altamira'),
  ponto(3, 'Drogasil - Uberlândia 14', 'Brasil'),
  ponto(4, 'Bretas - Loja 518', 'Centro'),
  ponto(8, 'Casas Bahia', 'Centro'),
  ponto(1, 'Drogasil - Uberlândia 11', 'Fundinho'),
  ponto(13, 'Ecoponto Luizote de Freitas', 'Luizote de Freitas'),
  ponto(6, 'Atacadão', 'Presidente Roosevelt'),
  ponto(5, 'Loja Elétrica', 'Santa Luzia'),
  ponto(12, 'Estação de Reciclagem - Parque do Sabiá', 'Santa Mônica'),
  ponto(7, 'Bahamas Mix', 'Santa Rosa'),
  ponto(9, 'Dmae - Núcleo de Coleta Seletiva', 'Tibery'),
  ponto(11, 'Estação de Reciclagem - Teatro Municipal', 'Tibery'),
];
const BRETAS = APROVADOS[3];

function paginaDe(lista: PontoDoPainel[], pagina = 1, tamanho = 7): PaginaDoPainel {
  return { itens: lista.slice((pagina - 1) * tamanho, pagina * tamanho), total: lista.length, pagina, tamanho };
}

describe('PainelPontosComponent', () => {
  let fixture: ComponentFixture<PainelPontosComponent>;
  let elemento: HTMLElement;
  let servidor: PontoDoPainel[];
  let pontos: jasmine.Spy<(status?: StatusDoPonto, pagina?: number, tamanho?: number) => Observable<PaginaDoPainel>>;
  let excluir: jasmine.Spy<(id: number) => Observable<void>>;
  let confirmar: jasmine.Spy;
  let mostrarAviso: jasmine.Spy;
  let excluidos: number;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function acao(idPonto: number, nome: 'editar' | 'excluir'): HTMLElement {
    const alvos = Array.from(elemento.querySelectorAll<HTMLElement>(`[data-ponto="${idPonto}"][data-acao="${nome}"]`));
    return alvos.find((item) => item.getClientRects().length > 0) ?? alvos[0];
  }

  function nomes(): string[] {
    return textos('.painel__cartao .painel__nome');
  }

  function criar(): void {
    fixture = TestBed.createComponent(PainelPontosComponent);
    elemento = fixture.nativeElement as HTMLElement;
    TestBed.inject(MudancasDoPainelService).pontoExcluido.subscribe(() => excluidos++);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    servidor = [...APROVADOS];
    excluidos = 0;
    pontos = jasmine
      .createSpy('pontos')
      .and.callFake((_status?: StatusDoPonto, pagina = 1, tamanho = 7) => of(paginaDe(servidor, pagina, tamanho)));
    excluir = jasmine.createSpy('excluir').and.callFake((id: number) => {
      servidor = servidor.filter((item) => item.idPonto !== id);
      return of(undefined);
    });
    await TestBed.configureTestingModule({
      imports: [PainelModule, RouterTestingModule],
      providers: [
        { provide: PainelService, useValue: { pontos, excluir } },
        { provide: HistoricoService, useValue: { posicao: 3 } },
      ],
    }).compileComponents();
    confirmar = spyOn(TestBed.inject(DialogoService), 'confirmar').and.resolveTo(true);
    mostrarAviso = spyOn(TestBed.inject(AvisoService), 'mostrar');
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => fixture?.destroy());

  it('pede os aprovados, 7 por vez, e monta a tabela da D14: Ponto, Materiais e Ações, com "Mostrando 7 de 13 pontos"', () => {
    criar();
    expect(pontos).toHaveBeenCalledOnceWith('APROVADO', 1, 7);
    expect(textos('eco-tabela thead th')).toEqual(['Ponto', 'Materiais', 'Ações']);
    expect(textos('eco-tabela .celula__nome')).toEqual(APROVADOS.slice(0, 7).map((item) => item.nome));
    expect(textos('eco-tabela .celula__local')[3]).toBe('Centro · Rua 4, 10');
    expect(textos('eco-tabela .tabela__resumo')).toEqual(['Mostrando 7 de 13 pontos']);
    expect(nomes()).toEqual(APROVADOS.slice(0, 7).map((item) => item.nome));
    expect(textos('.painel__resumo')).toEqual(['Mostrando 7 de 13 pontos']);
  });

  it('"Editar" é um link para a edição e "Excluir", um botão; os dois levam o nome do ponto para o leitor de tela', () => {
    criar();
    const editar = acao(4, 'editar');
    expect(editar.tagName).toBe('A');
    expect(editar.getAttribute('href')).toBe('/painel/pontos/4/editar');
    expect(editar.textContent?.replace(/\s+/g, ' ').trim()).toBe('Editar Bretas - Loja 518');
    const botaoExcluir = acao(4, 'excluir');
    expect(botaoExcluir.tagName).toBe('BUTTON');
    expect(botaoExcluir.textContent?.replace(/\s+/g, ' ').trim()).toBe('Excluir Bretas - Loja 518');
    expect(elemento.querySelector('eco-tabela [data-acao="editar"]')?.className).toContain('botao--p');
    expect(elemento.querySelector('.painel__cartao [data-acao="excluir"]')?.className).toContain('botao--g');
  });

  it('"Excluir" abre o diálogo com o nome do ponto e o botão vermelho; cancelado, nada muda', fakeAsync(() => {
    criar();
    confirmar.and.resolveTo(false);
    acao(4, 'excluir').click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(confirmar).toHaveBeenCalledOnceWith({
      titulo: 'Excluir “Bretas - Loja 518”?',
      texto: MENSAGEM_DOS_PONTOS.textoDaExclusao,
      confirmar: 'Excluir ponto',
      tipo: 'exclusao',
    });
    expect(excluir).not.toHaveBeenCalled();
    expect(nomes()).toContain(BRETAS.nome);
    expect(acao(4, 'excluir').getAttribute('aria-disabled')).toBeNull();
    flush();
  }));

  it('excluir o Bretas: os botões esperam a resposta, o aviso conta, a linha esmaece e sai, e a lista se completa com o Atacadão (D17)', fakeAsync(() => {
    criar();
    const resposta = new Subject<void>();
    excluir.and.callFake((id: number) => {
      servidor = servidor.filter((item) => item.idPonto !== id);
      return resposta;
    });
    const botao = acao(4, 'excluir');
    botao.focus();
    botao.click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(excluir).toHaveBeenCalledOnceWith(4);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao);
    botao.click();
    flushMicrotasks();
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(elemento.querySelector('.painel__rodape button')?.getAttribute('aria-disabled')).toBe('true');

    resposta.next();
    resposta.complete();
    fixture.detectChanges();
    expect(mostrarAviso).toHaveBeenCalledOnceWith('Bretas - Loja 518 excluído.');
    expect(excluidos).toBe(1);
    expect(elemento.querySelector('.painel__cartao--saindo .painel__nome')?.textContent?.trim()).toBe(BRETAS.nome);
    expect(pontos).toHaveBeenCalledWith('APROVADO', 1, 7);

    tick(DURACAO_DA_SAIDA_DA_LINHA_MS - 1);
    fixture.detectChanges();
    expect(nomes()).toContain(BRETAS.nome);
    tick(1);
    fixture.detectChanges();
    expect(nomes()).toEqual([
      'Drogaria São Paulo - DSP Uberlândia III',
      'Pão de Açúcar',
      'Drogasil - Uberlândia 14',
      'Casas Bahia',
      'Drogasil - Uberlândia 11',
      'Ecoponto Luizote de Freitas',
      'Atacadão',
    ]);
    expect(textos('.painel__resumo')).toEqual(['Mostrando 7 de 12 pontos']);
    expect(textos('eco-tabela .tabela__resumo')).toEqual(['Mostrando 7 de 12 pontos']);
    expect(document.activeElement).toBe(acao(8, 'excluir'));
  }));

  it('se a recarga demora, a linha sai no fim do esmaecer, e a lista se completa quando ela chega', fakeAsync(() => {
    criar();
    const recarga = new Subject<PaginaDoPainel>();
    pontos.and.returnValue(recarga);
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(nomes().length).toBe(6);
    expect(nomes()).not.toContain(BRETAS.nome);

    recarga.next(paginaDe(servidor));
    recarga.complete();
    fixture.detectChanges();
    expect(nomes().length).toBe(7);
    expect(nomes()[6]).toBe('Atacadão');
    expect(textos('.painel__resumo')).toEqual(['Mostrando 7 de 12 pontos']);
  }));

  it('uma recarga antiga não troca a lista que o "Mostrar mais" trouxe depois', fakeAsync(() => {
    criar();
    const recarga = new Subject<PaginaDoPainel>();
    pontos.and.returnValue(recarga);
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();

    pontos.and.callFake((_status?: StatusDoPonto, pagina = 1, tamanho = 7) => of(paginaDe(servidor, pagina, tamanho)));
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(nomes().length).toBe(12);

    recarga.next(paginaDe(servidor));
    recarga.complete();
    fixture.detectChanges();
    expect(nomes().length).toBe(12);
    flush();
  }));

  it('404 (outro administrador já excluiu): avisa e tira a linha do mesmo jeito', fakeAsync(() => {
    criar();
    excluir.and.callFake((id: number) => {
      servidor = servidor.filter((item) => item.idPonto !== id);
      return throwError(() => new ErroApi(404, 'NAO_ENCONTRADO', 'Ponto não encontrado.'));
    });
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(mostrarAviso).toHaveBeenCalledOnceWith(MENSAGEM_DOS_PONTOS.jaExcluido);
    expect(excluidos).toBe(1);
    expect(nomes()).not.toContain(BRETAS.nome);
    expect(textos('.painel__resumo')).toEqual(['Mostrando 7 de 12 pontos']);
  }));

  it('falha de rede: o aviso traz a mensagem, a linha fica e os botões voltam a responder', fakeAsync(() => {
    criar();
    excluir.and.returnValue(throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor.')));
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(mostrarAviso).toHaveBeenCalledOnceWith('Não foi possível falar com o servidor.');
    expect(excluidos).toBe(0);
    expect(nomes()).toContain(BRETAS.nome);
    expect(acao(4, 'excluir').getAttribute('aria-disabled')).toBeNull();
    expect(textos('.painel__resumo')).toEqual(['Mostrando 7 de 13 pontos']);

    excluir.and.callFake((id: number) => {
      servidor = servidor.filter((item) => item.idPonto !== id);
      return of(undefined);
    });
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(nomes()).not.toContain(BRETAS.nome);
  }));

  it('401: sem aviso (a sessão terminou, e a tela vai para Entrar), e a linha fica', fakeAsync(() => {
    criar();
    excluir.and.returnValue(throwError(() => new ErroApi(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.')));
    acao(4, 'excluir').click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(mostrarAviso).not.toHaveBeenCalled();
    expect(nomes()).toContain(BRETAS.nome);
    flush();
  }));

  it('"Mostrar mais" pede desde o começo com 7 a mais; com os 13, o botão some e o foco vai ao resumo', () => {
    criar();
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pontos).toHaveBeenCalledWith('APROVADO', 1, 14);
    expect(nomes()).toEqual(APROVADOS.map((item) => item.nome));
    expect(textos('.painel__resumo')).toEqual(['Mostrando 13 de 13 pontos']);
    expect(elemento.querySelector('.painel__rodape button')).toBeNull();
    expect(document.activeElement).toBe(elemento.querySelector('.painel__resumo'));
  });

  it('"Editar" guarda a lista como está, pela posição no histórico', () => {
    criar();
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    acao(8, 'editar').click();
    expect(TestBed.inject(RetornoDaEdicaoService).retomar(3, 'pontos')).toEqual({ aba: 'pontos', carregados: 13, id: 8 });
  });

  it('na volta da edição, a lista se refaz do mesmo tamanho, com o dado novo, e o foco vai ao "Editar" da linha', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(3, { aba: 'pontos', carregados: 13, id: 12 });
    servidor = servidor.map((item) => (item.idPonto === 12 ? { ...item, nome: 'Estação do Sabiá' } : item));
    criar();
    expect(pontos).toHaveBeenCalledOnceWith('APROVADO', 1, 13);
    expect(nomes()).toContain('Estação do Sabiá');
    expect(document.activeElement).toBe(acao(12, 'editar'));
  });

  it('na volta da edição, se a lista falha, o foco vai ao "Tentar de novo" (a tela de edição já saiu)', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(3, { aba: 'pontos', carregados: 7, id: 4 });
    pontos.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    expect(document.activeElement).toBe(elemento.querySelector('.painel__estado button'));
  });

  it('excluir durante um "Mostrar mais": ele sai, e a recarga depois da exclusão já traz os 7 a mais, sem o excluído', fakeAsync(() => {
    criar();
    const mais = new Subject<PaginaDoPainel>();
    pontos.and.returnValue(mais);
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();

    pontos.and.callFake((_status?: StatusDoPonto, pagina = 1, tamanho = 7) => of(paginaDe(servidor, pagina, tamanho)));
    acao(4, 'excluir').click();
    flushMicrotasks();
    expect(pontos).toHaveBeenCalledWith('APROVADO', 1, 14);
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(nomes()).toEqual(APROVADOS.filter((item) => item !== BRETAS).map((item) => item.nome));
    expect(textos('.painel__resumo')).toEqual(['Mostrando 12 de 12 pontos']);

    mais.next(paginaDe(APROVADOS, 1, 14));
    fixture.detectChanges();
    expect(nomes()).not.toContain(BRETAS.nome);
    flush();
  }));

  it('depois de uma recarga que trocou a lista, a próxima linha excluída também esmaece antes de sair', fakeAsync(() => {
    criar();
    const recarga = new Subject<PaginaDoPainel>();
    pontos.and.returnValue(recarga);
    acao(4, 'excluir').click();
    flushMicrotasks();
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    recarga.next(JSON.parse(JSON.stringify(paginaDe(servidor))) as PaginaDoPainel);
    recarga.complete();
    fixture.detectChanges();

    pontos.and.callFake((_status?: StatusDoPonto, pagina = 1, tamanho = 7) => of(paginaDe(servidor, pagina, tamanho)));
    acao(8, 'excluir').click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(textos('.painel__cartao--saindo .painel__nome')).toEqual(['Casas Bahia']);
    tick(DURACAO_DA_SAIDA_DA_LINHA_MS);
    fixture.detectChanges();
    expect(nomes()).not.toContain('Casas Bahia');
    flush();
  }));

  it('erro ao carregar mostra "Tentar de novo", que busca de novo e leva o foco ao painel da aba', () => {
    pontos.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    expect(textos('.painel__estado-mensagem')).toEqual(['Fora do ar.']);
    pontos.and.callFake((_status?: StatusDoPonto, pagina = 1, tamanho = 7) => of(paginaDe(servidor, pagina, tamanho)));
    (elemento.querySelector('.painel__estado button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(nomes().length).toBe(7);
  });

  it('sem pontos aprovados, mostra o estado vazio', () => {
    servidor = [];
    criar();
    expect(textos('.painel__estado-mensagem')).toEqual([MENSAGEM_DOS_PONTOS.vazio]);
    expect(elemento.querySelector('eco-tabela')).toBeNull();
  });

  it('se a aba sai com o diálogo aberto (o voltar do navegador), o diálogo fecha sem excluir', fakeAsync(() => {
    const dialogos = TestBed.inject(DialogoService);
    confirmar.and.callThrough();
    criar();
    acao(4, 'excluir').click();
    flushMicrotasks();
    const responder = spyOn(dialogos, 'responder').and.callThrough();
    fixture.destroy();
    flush();
    expect(responder).toHaveBeenCalledOnceWith(false);
    expect(excluir).not.toHaveBeenCalled();
  }));
});
