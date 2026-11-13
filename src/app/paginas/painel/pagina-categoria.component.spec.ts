import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { CategoriaDoPainel, NovaCategoria, PaginaDeCategorias } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { PaginaCategoriaComponent } from './pagina-categoria.component';
import { PainelModule } from './painel.module';
import { RetornoDaEdicaoService } from './retorno-da-edicao.service';

const PILHAS: CategoriaDoPainel = {
  idCategoria: 6,
  nome: 'Pilhas e baterias',
  descricao: 'Pilhas e baterias usadas, que não podem ir para o lixo comum.',
  pontos: 6,
};
const REPETIDO = 'Já existe uma categoria com este nome.';

describe('PaginaCategoriaComponent', () => {
  let fixture: ComponentFixture<PaginaCategoriaComponent>;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let categorias: jasmine.Spy<() => Observable<PaginaDeCategorias>>;
  let criarCategoria: jasmine.Spy<(dados: NovaCategoria) => Observable<CategoriaDoPainel>>;
  let editarCategoria: jasmine.Spy<(id: number, dados: NovaCategoria) => Observable<CategoriaDoPainel>>;
  let voltar: jasmine.Spy;
  let mostrar: jasmine.Spy;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function entrada(campo: 'nome' | 'descricao'): HTMLInputElement {
    return elemento.querySelector(`[data-campo="${campo}"] input`) as HTMLInputElement;
  }

  function digitar(campo: 'nome' | 'descricao', valor: string): void {
    entrada(campo).value = valor;
    entrada(campo).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function salvar(): void {
    (elemento.querySelector('.formulario__enviar') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function criar(id: string | null): void {
    parametros$.next(convertToParamMap(id === null ? {} : { id }));
    fixture = TestBed.createComponent(PaginaCategoriaComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    parametros$ = new BehaviorSubject(convertToParamMap({}));
    categorias = jasmine.createSpy('categorias').and.returnValue(of({ itens: [PILHAS], total: 1, pagina: 1, tamanho: 50 }));
    criarCategoria = jasmine
      .createSpy('criarCategoria')
      .and.callFake((dados: NovaCategoria) => of({ idCategoria: 11, ...dados, pontos: 0 }));
    editarCategoria = jasmine
      .createSpy('editarCategoria')
      .and.callFake((id: number, dados: NovaCategoria) => of({ idCategoria: id, ...dados, pontos: 6 }));
    voltar = jasmine.createSpy('voltar');
    await TestBed.configureTestingModule({
      imports: [PainelModule, RouterTestingModule],
      providers: [
        { provide: PainelService, useValue: { categorias, criarCategoria, editarCategoria } },
        { provide: HistoricoService, useValue: { voltar, posicao: 4 } },
        { provide: ActivatedRoute, useValue: { paramMap: parametros$.asObservable() } },
      ],
    }).compileComponents();
    mostrar = spyOn(TestBed.inject(AvisoService), 'mostrar');
  });

  afterEach(() => fixture?.destroy());

  it('nova categoria: o formulário vazio, com Nome (obrigatório) e Descrição (opcional), sem pedir nada à API', () => {
    criar(null);
    expect(categorias).not.toHaveBeenCalled();
    expect(textos('h1')).toEqual(['Nova categoria']);
    expect(textos('eco-campo-texto label')).toEqual(['Nome', 'Descrição (opcional)']);
    expect(entrada('nome').value).toBe('');
    expect(entrada('nome').getAttribute('aria-required') ?? entrada('nome').getAttribute('required')).not.toBeNull();
    expect(textos('.formulario__acoes button')).toEqual(['Cancelar', 'Cadastrar categoria']);
  });

  it('cadastrar manda o POST com o corpo limpo, avisa, guarda a categoria nova para o foco e volta à aba', () => {
    const retornos = TestBed.inject(RetornoDaEdicaoService);
    retornos.guardar(3, { aba: 'categorias', carregados: 0, id: null });
    criar(null);
    digitar('nome', '  Isopor ');
    digitar('descricao', '   ');
    salvar();
    expect(criarCategoria).toHaveBeenCalledOnceWith({ nome: 'Isopor', descricao: null });
    expect(mostrar).toHaveBeenCalledOnceWith('Categoria cadastrada.');
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=categorias');
    expect(retornos.retomar(3, 'categorias')).toEqual({ aba: 'categorias', carregados: 0, id: 11 });
  });

  it('nome vazio não chama a API: o erro aparece no campo e o foco vai a ele', () => {
    criar(null);
    salvar();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual(['Informe o nome da categoria.']);
    expect(document.activeElement).toBe(entrada('nome'));
    expect(criarCategoria).not.toHaveBeenCalled();
  });

  it('nome repetido (409) mostra o erro no campo, sem fechar o formulário; mudar o nome tira o erro', () => {
    criarCategoria.and.returnValue(
      throwError(() => new ErroApi(409, 'NOME_REPETIDO', REPETIDO, { nome: REPETIDO })),
    );
    criar(null);
    digitar('nome', 'plástico');
    salvar();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual([REPETIDO]);
    expect(document.activeElement).toBe(entrada('nome'));
    expect(voltar).not.toHaveBeenCalled();
    expect(mostrar).not.toHaveBeenCalled();
    expect(elemento.querySelector('form')).not.toBeNull();
    expect(entrada('nome').value).toBe('plástico');

    digitar('nome', 'Plástico filme');
    expect(elemento.querySelector('[data-campo="nome"] .campo__erro')).toBeNull();
  });

  it('um 409 sem o campo (o backend só manda a mensagem) também vai ao campo nome', () => {
    criarCategoria.and.returnValue(throwError(() => new ErroApi(409, 'CONFLITO', 'Os dados mudaram.')));
    criar(null);
    digitar('nome', 'Vidro');
    salvar();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual([REPETIDO]);
  });

  it('durante o envio, o botão diz "Salvando…", fica indisponível e um segundo envio é ignorado', () => {
    criarCategoria.and.returnValue(new Subject<CategoriaDoPainel>());
    criar(null);
    digitar('nome', 'Isopor');
    salvar();
    salvar();
    const botao = elemento.querySelector('.formulario__enviar') as HTMLButtonElement;
    expect(botao.textContent?.trim()).toBe('Salvando…');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(criarCategoria).toHaveBeenCalledTimes(1);
  });

  it('rede fora do ar: o que foi digitado fica, com "Tentar de novo", que reenvia', () => {
    criarCategoria.and.returnValue(throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.')));
    criar(null);
    digitar('nome', 'Isopor');
    salvar();
    expect(textos('.formulario__aviso p')).toEqual(['Sem conexão.']);
    expect(entrada('nome').value).toBe('Isopor');
    criarCategoria.and.callFake((dados: NovaCategoria) => of({ idCategoria: 11, ...dados, pontos: 0 }));
    (elemento.querySelector('.formulario__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(criarCategoria).toHaveBeenCalledTimes(2);
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=categorias');
  });

  it('editar: preenchido com a categoria da lista; salva por PUT sem perder os pontos, com o aviso', () => {
    criar('6');
    expect(categorias).toHaveBeenCalledTimes(1);
    expect(textos('h1')).toEqual(['Editar categoria']);
    expect(entrada('nome').value).toBe('Pilhas e baterias');
    expect(entrada('descricao').value).toBe(PILHAS.descricao as string);
    expect(textos('.formulario__acoes button')).toEqual(['Cancelar', 'Salvar alterações']);

    digitar('nome', 'Pilhas, baterias e carregadores');
    digitar('descricao', 'Pilhas, baterias e carregadores sem uso.');
    salvar();
    expect(editarCategoria).toHaveBeenCalledOnceWith(6, {
      nome: 'Pilhas, baterias e carregadores',
      descricao: 'Pilhas, baterias e carregadores sem uso.',
    });
    expect(mostrar).toHaveBeenCalledOnceWith('Categoria atualizada.');
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=categorias');
  });

  it('com mais de 50 categorias, a edição procura o id nas páginas seguintes', () => {
    const todas = Array.from({ length: 55 }, (_, i) => ({ idCategoria: i + 1, nome: `Categoria ${i + 1}`, descricao: null, pontos: 0 }));
    categorias.and.callFake(((numero = 1) =>
      of({ itens: todas.slice((numero - 1) * 50, numero * 50), total: 55, pagina: numero, tamanho: 50 })) as () => Observable<PaginaDeCategorias>);
    criar('53');
    expect(categorias).toHaveBeenCalledTimes(2);
    expect(entrada('nome').value).toBe('Categoria 53');
  });

  it('um 400 do backend põe cada erro no campo certo', () => {
    editarCategoria.and.returnValue(
      throwError(() => new ErroApi(400, 'DADOS_INVALIDOS', 'Confira.', { descricao: 'Use até 255 caracteres.' })),
    );
    criar('6');
    salvar();
    expect(textos('[data-campo="descricao"] .campo__erro')).toEqual(['Use até 255 caracteres.']);
    expect(document.activeElement).toBe(entrada('descricao'));
  });

  it('categoria que não está na lista, ou id inválido: "Categoria não encontrada", com o caminho de volta', () => {
    criar('99');
    expect(textos('h1')).toEqual(['Categoria não encontrada']);
    expect(elemento.querySelector('form')).toBeNull();
    expect(elemento.querySelector('.editar__estado a')?.getAttribute('href')).toBe('/painel?aba=categorias');

    fixture.destroy();
    categorias.calls.reset();
    criar('abc');
    expect(categorias).not.toHaveBeenCalled();
    expect(textos('h1')).toEqual(['Categoria não encontrada']);
  });

  it('servidor fora do ar ao abrir: "Tentar de novo" busca de novo', () => {
    categorias.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar('6');
    expect(textos('h1')).toEqual(['Não foi possível abrir a categoria']);
    categorias.and.returnValue(of({ itens: [PILHAS], total: 1, pagina: 1, tamanho: 50 }));
    (elemento.querySelector('.editar__estado button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(entrada('nome').value).toBe('Pilhas e baterias');
  });

  it('"Cancelar" volta à aba Categorias, sem salvar', () => {
    criar('6');
    (elemento.querySelector('.formulario__acoes button') as HTMLButtonElement).click();
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=categorias');
    expect(editarCategoria).not.toHaveBeenCalled();
  });
});
