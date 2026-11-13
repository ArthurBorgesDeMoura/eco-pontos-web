import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { PontoDetalhe } from '../../api/modelos';
import { PontosService } from '../../api/pontos.service';
import { linkDoMapa } from '../../compartilhado/mapa';
import { PaginaPontoComponent } from './pagina-ponto.component';
import { PontoModule } from './ponto.module';

@Component({ template: '' })
class VazioComponent {}

const LUIZOTE: PontoDetalhe = {
  idPonto: 13,
  nome: 'Ecoponto Luizote de Freitas',
  endereco: 'Rua Wilson Gonçalves de Souza, 10',
  horario: '7h às 19h, todos os dias',
  contato: null,
  bairro: { idBairro: 11, nome: 'Luizote de Freitas' },
  materiais: [
    { idCategoria: 1, nome: 'Papel e papelão', descricao: 'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.' },
    { idCategoria: 10, nome: 'Entulho e volumosos', descricao: null },
  ],
};

describe('PaginaPontoComponent', () => {
  let fixture: ComponentFixture<PaginaPontoComponent> | undefined;
  let elemento: HTMLElement;
  let parametros$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let detalhar: jasmine.Spy<(id: number) => Observable<PontoDetalhe>>;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function abrir(id: string): void {
    fixture?.destroy();
    parametros$.next(convertToParamMap({ id }));
    const nova = TestBed.createComponent(PaginaPontoComponent);
    fixture = nova;
    elemento = nova.nativeElement as HTMLElement;
    nova.detectChanges();
  }

  function atual(): ComponentFixture<PaginaPontoComponent> {
    if (!fixture) {
      throw new Error('Abra o detalhe antes.');
    }
    return fixture;
  }

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
  });

  beforeEach(async () => {
    detalhar = jasmine.createSpy('detalhar').and.returnValue(of(LUIZOTE));
    parametros$ = new BehaviorSubject(convertToParamMap({ id: '13' }));
    await TestBed.configureTestingModule({
      imports: [PontoModule, RouterTestingModule.withRoutes([{ path: '', component: VazioComponent }])],
      declarations: [VazioComponent],
      providers: [
        { provide: PontosService, useValue: { detalhar } },
        { provide: ActivatedRoute, useValue: { paramMap: parametros$ } },
      ],
    }).compileComponents();
  });

  it('mostra nome, subtítulo, endereço, bairro, horário e os materiais com a descrição', () => {
    abrir('13');

    expect(detalhar).toHaveBeenCalledOnceWith(13);
    expect(textos('h1')).toEqual(['Ecoponto Luizote de Freitas']);
    expect(textos('.ponto__subtitulo')).toEqual(['Luizote de Freitas · Uberlândia – MG']);
    expect(textos('.ponto__rotulo')).toEqual(['Endereço', 'Bairro', 'Horário de funcionamento', 'Contato']);
    expect(textos('.ponto__valor')).toEqual([
      'Rua Wilson Gonçalves de Souza, 10',
      'Luizote de Freitas',
      '7h às 19h, todos os dias',
      'Não informado',
    ]);
    expect(textos('.ponto__materiais-titulo')).toEqual(['Materiais aceitos']);
    expect(textos('.ponto__materiais-contagem')).toEqual(['2']);
    expect(textos('.ponto__material-nome')).toEqual(['Papel e papelão', 'Entulho e volumosos']);
    expect(textos('.ponto__material-descricao')).toEqual([
      'Jornais, revistas, cadernos, caixas de papelão e embalagens longa vida.',
    ]);
    expect(TestBed.inject(Title).getTitle()).toBe('Ecoponto Luizote de Freitas · EcoPonto');
  });

  it('horário e contato null aparecem como "Não informado", com a cor de apoio', () => {
    detalhar.and.returnValue(of({ ...LUIZOTE, horario: null, contato: null }));
    abrir('13');

    const valores = Array.from(elemento.querySelectorAll('.ponto__valor'));
    expect(valores.slice(2).map((valor) => valor.textContent?.trim())).toEqual(['Não informado', 'Não informado']);
    expect(valores.slice(2).every((valor) => valor.classList.contains('ponto__valor--vazio'))).toBeTrue();
    expect(valores[0].classList).not.toContain('ponto__valor--vazio');
  });

  it('"Abrir no mapa" vai ao Google Maps com endereço, bairro e cidade, em outra aba', () => {
    abrir('13');

    const mapa = elemento.querySelector('a.ponto__mapa') as HTMLAnchorElement;
    expect(mapa.href).toBe(linkDoMapa('Rua Wilson Gonçalves de Souza, 10', 'Luizote de Freitas'));
    expect(mapa.href).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20Wilson%20Gon%C3%A7alves%20de%20Souza%2C%2010%2C%20Luizote%20de%20Freitas%2C%20Uberl%C3%A2ndia%20-%20MG',
    );
    expect(mapa.target).toBe('_blank');
    expect(mapa.rel).toBe('noopener noreferrer');
    expect(mapa.textContent?.replace(/\s+/g, ' ').trim()).toBe('Abrir no mapa (abre em outra aba)');
  });

  it('enquanto carrega, mostra o esqueleto escondido do leitor de tela e um aviso de carregando', () => {
    detalhar.and.returnValue(new Subject<PontoDetalhe>());
    abrir('13');

    expect(elemento.querySelector('.ponto__pagina[aria-hidden="true"] .esqueleto-barra')).not.toBeNull();
    expect(elemento.querySelector('h1')).toBeNull();
    expect(elemento.querySelector('a[href^="https://www.google.com"]')).toBeNull();
  });

  it('404 mostra "Ponto não encontrado" e o link para a busca', () => {
    detalhar.and.returnValue(throwError(() => new ErroApi(404, 'NAO_ENCONTRADO', 'Ponto não encontrado.')));
    abrir('999');

    expect(textos('h1')).toEqual(['Ponto não encontrado']);
    const busca = elemento.querySelector('.ponto__estado a') as HTMLAnchorElement;
    expect(busca.textContent?.trim()).toBe('Ir para a busca');
    expect(busca.getAttribute('href')).toBe('/');
    expect(TestBed.inject(Title).getTitle()).toBe('Ponto não encontrado · EcoPonto');
  });

  it('id que não é número mostra "Ponto não encontrado" sem chamar a API', () => {
    for (const id of ['abc', '0', '1e3', '99999999999']) {
      detalhar.calls.reset();
      abrir(id);
      expect(textos('h1')).withContext(id).toEqual(['Ponto não encontrado']);
      expect(detalhar).withContext(id).not.toHaveBeenCalled();
    }
  });

  it('servidor fora do ar mostra a mensagem e "Tentar de novo", que busca outra vez', () => {
    detalhar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'O servidor está fora do ar agora.')));
    abrir('13');

    expect(textos('[role="alert"] h1')).toEqual(['Não foi possível abrir o ponto']);
    expect(textos('[role="alert"] .ponto__texto')).toEqual(['O servidor está fora do ar agora.']);
    detalhar.and.returnValue(of(LUIZOTE));
    (elemento.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    atual().detectChanges();

    expect(detalhar).toHaveBeenCalledTimes(2);
    expect(textos('h1')).toEqual(['Ecoponto Luizote de Freitas']);
    expect(document.activeElement).toBe(elemento.querySelector('h1'));
  });

  function voltarDaTela(): HTMLAnchorElement {
    return elemento.querySelector('a.ponto__voltar') as HTMLAnchorElement;
  }

  it('"Pontos de coleta" volta no histórico quando há uma página do EcoPonto antes desta', () => {
    abrir('13');
    const historico = TestBed.inject(Location);
    spyOn(historico, 'back');
    spyOn(historico, 'getState').and.returnValue({ navigationId: 4, ɵrouterPageId: 1 });
    expect(voltarDaTela().getAttribute('href')).toBe('/');
    expect(voltarDaTela().textContent?.trim()).toBe('Pontos de coleta');

    voltarDaTela().click();
    voltarDaTela().click();
    expect(historico.back).toHaveBeenCalledTimes(1);
  });

  it('"Pontos de coleta" vai à busca quando esta é a primeira página do EcoPonto (link direto, aba nova)', () => {
    abrir('13');
    const historico = TestBed.inject(Location);
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    spyOn(historico, 'back');
    spyOn(historico, 'getState').and.returnValue({ navigationId: 7, ɵrouterPageId: 0 });

    voltarDaTela().click();
    expect(historico.back).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledOnceWith('/');
  });

  it('Ctrl+clique em "Pontos de coleta" abre a busca em outra aba: o sistema não intercepta', () => {
    abrir('13');
    const historico = TestBed.inject(Location);
    spyOn(historico, 'back');
    const evento = new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true });
    let interceptado = true;
    voltarDaTela().addEventListener('click', (e) => {
      interceptado = e.defaultPrevented;
      e.preventDefault();
    }, { once: true });
    voltarDaTela().dispatchEvent(evento);
    expect(interceptado).toBeFalse();
    expect(historico.back).not.toHaveBeenCalled();
  });

  it('"Tentar de novo" deixa o erro e o botão na tela enquanto busca; se falhar outra vez, o foco fica no botão', () => {
    detalhar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    abrir('13');
    const botao = (): HTMLButtonElement => elemento.querySelector('[role="alert"] button') as HTMLButtonElement;

    const resposta = new Subject<PontoDetalhe>();
    detalhar.and.returnValue(resposta);
    botao().focus();
    botao().click();
    atual().detectChanges();
    expect(botao()).not.toBeNull();
    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao());
    botao().click();
    expect(detalhar).toHaveBeenCalledTimes(2);

    resposta.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    atual().detectChanges();
    expect(botao().getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(botao());
  });

  it('o aviso de carregando entra numa região viva que já existia vazia', fakeAsync(() => {
    detalhar.and.returnValue(new Subject<PontoDetalhe>());
    abrir('13');
    const regiao = elemento.querySelector('[role="status"]') as HTMLElement;
    expect(regiao.textContent?.trim()).toBe('');

    tick();
    atual().detectChanges();
    expect(elemento.querySelector('[role="status"]')).toBe(regiao);
    expect(regiao.textContent?.trim()).toBe('Carregando o ponto…');
  }));

  it('sair para outra tela que não a busca é na hora; para a busca, espera a animação ou o limite', fakeAsync(() => {
    abrir('13');
    const tela = atual().componentInstance;

    expect(tela.sair('/entrar')).toBeTrue();
    expect(elemento.classList).not.toContain('ponto--sair');

    const resultado = tela.sair('/?bairro=11');
    expect(elemento.classList).toContain('ponto--sair');
    let saiu: boolean | undefined;
    if (resultado instanceof Promise) {
      void resultado.then((valor) => (saiu = valor));
      tick(400);
    } else {
      saiu = resultado;
    }
    expect(saiu).toBeTrue();
  }));
});
