import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { ErroApi } from '../../api/erro-api';
import { NovaSugestao, PontoDetalhe } from '../../api/modelos';
import { PainelService } from '../../api/painel.service';
import { PontosService } from '../../api/pontos.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { PaginaEditarPontoComponent, dadosDoPonto } from './pagina-editar-ponto.component';
import { PainelModule } from './painel.module';

const BAIRROS = [
  { idBairro: 4, nome: 'Centro' },
  { idBairro: 8, nome: 'Fundinho' },
];
const CATEGORIAS = [
  { idCategoria: 5, nome: 'Eletrônicos', descricao: null },
  { idCategoria: 6, nome: 'Pilhas e baterias', descricao: null },
  { idCategoria: 7, nome: 'Lâmpadas', descricao: null },
];
const BRETAS: PontoDetalhe = {
  idPonto: 4,
  nome: 'Bretas - Loja 518',
  endereco: 'Av. João Pinheiro, 77',
  horario: null,
  contato: '(34) 3333-0000',
  bairro: { idBairro: 4, nome: 'Centro' },
  materiais: [
    { idCategoria: 7, nome: 'Lâmpadas', descricao: null },
    { idCategoria: 6, nome: 'Pilhas e baterias', descricao: null },
  ],
};

describe('PaginaEditarPontoComponent', () => {
  let fixture: ComponentFixture<PaginaEditarPontoComponent>;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let detalhar: jasmine.Spy<(id: number) => Observable<PontoDetalhe>>;
  let editar: jasmine.Spy<(id: number, dados: NovaSugestao) => Observable<PontoDetalhe>>;
  let voltar: jasmine.Spy;
  let mostrar: jasmine.Spy;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function entrada(campo: string): HTMLInputElement {
    return elemento.querySelector(`[data-campo="${campo}"] input`) as HTMLInputElement;
  }

  function caixa(nome: string): HTMLInputElement {
    const chip = Array.from(elemento.querySelectorAll('eco-chip-material')).find(
      (item) => item.querySelector('label')?.textContent?.trim() === nome,
    );
    return chip?.querySelector('input[type="checkbox"]') as HTMLInputElement;
  }

  function digitar(campo: string, valor: string): void {
    entrada(campo).value = valor;
    entrada(campo).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function salvar(): void {
    (elemento.querySelector('.formulario__enviar') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function criar(id = '4'): void {
    parametros$.next(convertToParamMap({ id }));
    fixture = TestBed.createComponent(PaginaEditarPontoComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    parametros$ = new BehaviorSubject(convertToParamMap({ id: '4' }));
    detalhar = jasmine.createSpy('detalhar').and.returnValue(of(BRETAS));
    editar = jasmine.createSpy('editar').and.callFake((_id: number, dados: NovaSugestao) => of({ ...BRETAS, nome: dados.nome }));
    voltar = jasmine.createSpy('voltar');
    await TestBed.configureTestingModule({
      imports: [PainelModule, RouterTestingModule],
      providers: [
        { provide: ApiService, useValue: { get: (rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS) } },
        { provide: PontosService, useValue: { detalhar } },
        { provide: PainelService, useValue: { editar } },
        { provide: HistoricoService, useValue: { voltar } },
        { provide: ActivatedRoute, useValue: { paramMap: parametros$.asObservable() } },
      ],
    }).compileComponents();
    mostrar = spyOn(TestBed.inject(AvisoService), 'mostrar');
  });

  it('preenche o formulário do FE-10 com GET /api/pontos/{id}: o bairro e os materiais pelos ids, e o vazio como texto vazio', () => {
    criar();
    expect(detalhar).toHaveBeenCalledOnceWith(4);
    expect(textos('h1')).toEqual(['Editar ponto']);
    expect(entrada('nome').value).toBe('Bretas - Loja 518');
    expect(entrada('endereco').value).toBe('Av. João Pinheiro, 77');
    expect(textos('[data-campo="idBairro"] [role="combobox"]')).toEqual(['Centro']);
    expect(entrada('horario').value).toBe('');
    expect(entrada('contato').value).toBe('(34) 3333-0000');
    expect(caixa('Pilhas e baterias').checked).toBeTrue();
    expect(caixa('Lâmpadas').checked).toBeTrue();
    expect(caixa('Eletrônicos').checked).toBeFalse();
    expect(textos('.formulario__acoes button')).toEqual(['Cancelar', 'Salvar alterações']);
  });

  it('salvar manda o PUT com o corpo limpo, avisa "Ponto atualizado." e volta à aba Pontos', () => {
    criar();
    digitar('nome', '  Bretas - Centro ');
    caixa('Eletrônicos').click();
    fixture.detectChanges();
    salvar();
    expect(editar).toHaveBeenCalledOnceWith(4, {
      nome: 'Bretas - Centro',
      endereco: 'Av. João Pinheiro, 77',
      idBairro: 4,
      horario: null,
      contato: '(34) 3333-0000',
      categorias: [5, 6, 7],
    });
    expect(mostrar).toHaveBeenCalledOnceWith('Ponto atualizado.');
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=pontos');
  });

  it('durante o envio, o botão diz "Salvando…", fica indisponível e um segundo envio é ignorado', () => {
    editar.and.returnValue(new Subject<PontoDetalhe>());
    criar();
    salvar();
    salvar();
    const botao = elemento.querySelector('.formulario__enviar') as HTMLButtonElement;
    expect(botao.textContent?.trim()).toBe('Salvando…');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(editar).toHaveBeenCalledTimes(1);
  });

  it('valida como a sugestão: nome vazio não chama a API; um 400 do backend vai ao campo', () => {
    criar();
    digitar('nome', '   ');
    salvar();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual(['Informe o nome do ponto.']);
    expect(editar).not.toHaveBeenCalled();

    editar.and.returnValue(throwError(() => new ErroApi(400, 'DADOS_INVALIDOS', 'Confira.', { endereco: 'Endereço inválido.' })));
    digitar('nome', 'Bretas');
    salvar();
    expect(textos('[data-campo="endereco"] .campo__erro')).toEqual(['Endereço inválido.']);
    expect(voltar).not.toHaveBeenCalled();
  });

  it('404 ao salvar (outro administrador excluiu): mostra a mensagem, sem "Tentar de novo", e não volta sozinho', () => {
    editar.and.returnValue(throwError(() => new ErroApi(404, 'NAO_ENCONTRADO', 'Ponto não encontrado.')));
    criar();
    salvar();
    expect(textos('.formulario__aviso p')).toEqual(['Ponto não encontrado.']);
    expect(elemento.querySelector('.formulario__aviso button')).toBeNull();
    expect(mostrar).not.toHaveBeenCalled();
    expect(voltar).not.toHaveBeenCalled();
  });

  it('rede fora do ar ao salvar: o que foi digitado fica, com "Tentar de novo"', () => {
    editar.and.returnValue(throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor.')));
    criar();
    digitar('nome', 'Bretas - Centro');
    salvar();
    expect(textos('.formulario__aviso p')).toEqual(['Não foi possível falar com o servidor.']);
    expect(entrada('nome').value).toBe('Bretas - Centro');
    expect(textos('.formulario__aviso button')).toEqual(['Tentar de novo']);
  });

  it('"Cancelar" volta à aba Pontos, sem salvar', () => {
    criar();
    (elemento.querySelector('.formulario__acoes button') as HTMLButtonElement).click();
    expect(voltar).toHaveBeenCalledOnceWith('/painel?aba=pontos');
    expect(editar).not.toHaveBeenCalled();
  });

  it('ponto que não existe (404) ou id inválido: "Ponto não encontrado", com o caminho de volta ao painel', () => {
    detalhar.and.returnValue(throwError(() => new ErroApi(404, 'NAO_ENCONTRADO', 'Ponto não encontrado.')));
    criar();
    expect(textos('h1')).toEqual(['Ponto não encontrado']);
    expect(elemento.querySelector('eco-formulario-ponto')).toBeNull();
    expect(elemento.querySelector('.editar__estado a')?.getAttribute('href')).toBe('/painel?aba=pontos');

    fixture.destroy();
    detalhar.calls.reset();
    criar('abc');
    expect(detalhar).not.toHaveBeenCalled();
    expect(textos('h1')).toEqual(['Ponto não encontrado']);
  });

  it('servidor fora do ar ao abrir: "Tentar de novo" busca o ponto de novo', () => {
    detalhar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    criar();
    expect(textos('h1')).toEqual(['Não foi possível abrir o ponto']);
    expect(textos('.editar__estado p')).toEqual(['Fora do ar.']);

    detalhar.and.returnValue(of(BRETAS));
    (elemento.querySelector('.editar__estado button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(detalhar).toHaveBeenCalledTimes(2);
    expect(entrada('nome').value).toBe('Bretas - Loja 518');
  });

  it('dadosDoPonto aguenta item sem materiais nem bairro (formato ainda provisório)', () => {
    const torto = { ...BRETAS, bairro: null, materiais: undefined } as unknown as PontoDetalhe;
    expect(dadosDoPonto(torto)).toEqual({
      nome: 'Bretas - Loja 518',
      endereco: 'Av. João Pinheiro, 77',
      idBairro: null,
      horario: '',
      contato: '(34) 3333-0000',
      categorias: [],
    });
  });
});
