import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { CategoriaDoPainel, PaginaDeCategorias } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { MENSAGEM_DAS_CATEGORIAS, PainelCategoriasComponent } from './painel-categorias.component';
import { PainelModule } from './painel.module';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

function categoria(idCategoria: number, nome: string, pontos: number, descricao: string | null = `Sobre ${nome}.`): CategoriaDoPainel {
  return { idCategoria, nome, descricao, pontos };
}

const DO_SCRIPT: CategoriaDoPainel[] = [
  categoria(1, 'Papel e papelão', 3),
  categoria(2, 'Plástico', 3),
  categoria(3, 'Metal', 3),
  categoria(4, 'Vidro', 3),
  categoria(5, 'Eletrônicos', 2),
  categoria(6, 'Pilhas e baterias', 6),
  categoria(7, 'Lâmpadas', 3),
  categoria(8, 'Óleo de cozinha usado', 2),
  categoria(9, 'Medicamentos vencidos', 3),
  categoria(10, 'Entulho e volumosos', 1),
];

function pagina(itens: CategoriaDoPainel[], total = itens.length): PaginaDeCategorias {
  return { itens, total, pagina: 1, tamanho: 50 };
}

describe('PainelCategoriasComponent', () => {
  let fixture: ComponentFixture<PainelCategoriasComponent>;
  let elemento: HTMLElement;
  let categorias: jasmine.Spy<(pagina?: number) => Observable<PaginaDeCategorias>>;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function editar(idCategoria: number): HTMLElement {
    const alvos = Array.from(elemento.querySelectorAll<HTMLElement>(`[data-categoria="${idCategoria}"][data-acao="editar"]`));
    return alvos.find((item) => item.getClientRects().length > 0) ?? alvos[0];
  }

  function criar(): void {
    fixture = TestBed.createComponent(PainelCategoriasComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    categorias = jasmine.createSpy('categorias').and.returnValue(of(pagina(DO_SCRIPT)));
    await TestBed.configureTestingModule({
      imports: [PainelModule, RouterTestingModule],
      providers: [
        { provide: PainelService, useValue: { categorias } },
        { provide: HistoricoService, useValue: { posicao: 3 } },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => fixture?.destroy());

  it('a tabela da D16 mostra as 10 categorias, com a descrição e os pontos aprovados, e o rodapé "10 categorias"', () => {
    criar();
    expect(categorias).toHaveBeenCalledOnceWith(1);
    expect(textos('eco-tabela thead th')).toEqual(['Categoria', 'Descrição', 'Pontos', 'Ações']);
    expect(textos('eco-tabela .categorias__nome')).toEqual(DO_SCRIPT.map((item) => item.nome));
    expect(textos('eco-tabela .categorias__pontos')).toEqual(['3', '3', '3', '3', '2', '6', '3', '2', '3', '1']);
    expect(textos('eco-tabela tbody tr:first-child td')[1]).toBe('Sobre Papel e papelão.');
    expect(textos('eco-tabela .tabela__resumo')).toEqual(['10 categorias']);
    expect(elemento.querySelector('eco-tabela .tabela__rodape button')).toBeNull();
    expect(elemento.querySelector('eco-tabela')?.classList).toContain('tabela--compacta');
  });

  it('no celular e no tablet, a lista de nome, descrição e pontos, com "Editar" de 44 px', () => {
    criar();
    expect(textos('.painel__cartao .painel__nome')).toEqual(DO_SCRIPT.map((item) => item.nome));
    expect(textos('.painel__cartao .painel__materiais').slice(4, 6)).toEqual(['2 pontos', '6 pontos']);
    expect(textos('.painel__cartao .painel__materiais')[9]).toBe('1 ponto');
    expect(textos('.painel__resumo')).toEqual(['10 categorias']);
    expect(elemento.querySelector('.painel__cartao [data-acao="editar"]')?.className).toContain('botao--g');
  });

  it('"Editar" é um link para o formulário, com o nome da categoria para o leitor de tela', () => {
    criar();
    const link = editar(6);
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/painel/categorias/6/editar');
    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe('Editar Pilhas e baterias');
    expect(elemento.querySelector('eco-tabela [data-acao="editar"]')?.className).toContain('botao--texto');
  });

  it('categoria sem descrição mostra a frase provisória, e uma só diz "1 categoria"', () => {
    categorias.and.returnValue(of(pagina([categoria(11, 'Isopor', 0, null)])));
    criar();
    expect(textos('eco-tabela tbody tr:first-child td')[1]).toBe(MENSAGEM_DAS_CATEGORIAS.semDescricao);
    expect(textos('.painel__cartao .painel__materiais')).toEqual(['0 pontos']);
    expect(textos('.painel__resumo')).toEqual(['1 categoria']);
  });

  it('"Editar" guarda a aba, pela posição no histórico, para o foco voltar à linha', () => {
    criar();
    editar(6).click();
    expect(TestBed.inject(RetornoDaEdicaoService).retomar(3, 'categorias')).toEqual({ aba: 'categorias', carregados: 10, id: 6 });
  });

  it('na volta do formulário, a lista vem de novo e o foco vai ao "Editar" da categoria salva', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(3, { aba: 'categorias', carregados: 10, id: 11 });
    categorias.and.returnValue(of(pagina([...DO_SCRIPT, categoria(11, 'Isopor', 0)])));
    criar();
    expect(textos('.painel__cartao .painel__nome')[10]).toBe('Isopor');
    expect(document.activeElement).toBe(editar(11));
  });

  it('erro ao carregar mostra "Tentar de novo", que busca de novo; na volta do formulário, o foco vai a ele', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(3, { aba: 'categorias', carregados: 10, id: 6 });
    categorias.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    expect(textos('.painel__estado-mensagem')).toEqual(['Fora do ar.']);
    const botao = elemento.querySelector('.painel__estado button') as HTMLButtonElement;
    expect(document.activeElement).toBe(botao);

    categorias.and.returnValue(of(pagina(DO_SCRIPT)));
    botao.click();
    fixture.detectChanges();
    expect(textos('.painel__cartao .painel__nome').length).toBe(10);
  });

  it('na volta do formulário depois de um "Mostrar mais" (mais de 50), a aba lê as páginas que estavam na tela', () => {
    TestBed.inject(RetornoDaEdicaoService).guardar(3, { aba: 'categorias', carregados: 55, id: 55 });
    const todas = Array.from({ length: 60 }, (_, i) => categoria(i + 1, `Categoria ${i + 1}`, 0));
    categorias.and.callFake((numero = 1) => of({ itens: todas.slice((numero - 1) * 50, numero * 50), total: 60, pagina: numero, tamanho: 50 }));
    criar();
    expect(categorias.calls.allArgs()).toEqual([[1], [2]]);
    expect(textos('.painel__cartao .painel__nome').length).toBe(60);
    expect(document.activeElement).toBe(editar(55));
  });

  it('com mais de 50 (raro), "Mostrar mais" traz a página seguinte sem repetir', () => {
    const muitas = Array.from({ length: 50 }, (_, i) => categoria(i + 1, `Categoria ${i + 1}`, 0));
    categorias.and.returnValues(
      of(pagina(muitas, 52)),
      of({ itens: [categoria(50, 'Categoria 50', 0), categoria(51, 'Categoria 51', 0), categoria(52, 'Categoria 52', 0)], total: 52, pagina: 2, tamanho: 50 }),
    );
    criar();
    (elemento.querySelector('.painel__rodape button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(categorias).toHaveBeenCalledWith(2);
    expect(textos('.painel__cartao .painel__nome').length).toBe(52);
    expect(elemento.querySelector('.painel__rodape button')).toBeNull();
  });
});
