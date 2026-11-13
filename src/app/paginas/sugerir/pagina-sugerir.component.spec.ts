import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { ErroApi } from '../../api/erro-api';
import { NovaSugestao, PontoCriado } from '../../api/modelos';
import { PontosService } from '../../api/pontos.service';
import { AvisoService } from '../../compartilhado/aviso/aviso.service';
import { HistoricoService } from '../../compartilhado/historico.service';
import { FormularioDoPontoComponent } from '../formulario-ponto/formulario-ponto.component';
import { AVISO_DE_SUGESTAO_ENVIADA, PaginaSugerirComponent } from './pagina-sugerir.component';
import { SugerirModule } from './sugerir.module';

const BAIRROS = [
  { idBairro: 11, nome: 'Luizote de Freitas' },
  { idBairro: 13, nome: 'Morumbi' },
];
const CATEGORIAS = [
  { idCategoria: 1, nome: 'Papel e papelão', descricao: null },
  { idCategoria: 2, nome: 'Plástico', descricao: null },
  { idCategoria: 6, nome: 'Pilhas e baterias', descricao: null },
];

describe('PaginaSugerirComponent', () => {
  let fixture: ComponentFixture<PaginaSugerirComponent>;
  let elemento: HTMLElement;
  let obter: jasmine.Spy<(rota: string) => Observable<unknown>>;
  let sugerir: jasmine.Spy<(dados: NovaSugestao) => Observable<PontoCriado>>;
  let voltar: jasmine.Spy;
  let navegar: jasmine.Spy;
  let mostrar: jasmine.Spy;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function digitar(rotulo: string, valor: string): void {
    const campo = Array.from(elemento.querySelectorAll('eco-campo-texto')).find(
      (item) => item.querySelector('label')?.textContent?.trim() === rotulo,
    );
    const entrada = campo?.querySelector('input') as HTMLInputElement;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function escolherBairro(nome: string): void {
    (elemento.querySelector('[data-campo="idBairro"] [role="combobox"]') as HTMLElement).click();
    fixture.detectChanges();
    const opcao = Array.from(elemento.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (item) => item.textContent?.trim() === nome,
    );
    opcao?.click();
    fixture.detectChanges();
  }

  function caixa(nome: string): HTMLInputElement {
    const chip = Array.from(elemento.querySelectorAll('eco-chip-material')).find(
      (item) => item.querySelector('label')?.textContent?.trim() === nome,
    );
    return chip?.querySelector('input[type="checkbox"]') as HTMLInputElement;
  }

  function marcar(nome: string): void {
    caixa(nome).click();
    fixture.detectChanges();
  }

  function formulario(): FormularioDoPontoComponent['formulario'] {
    return (fixture.debugElement.query(By.directive(FormularioDoPontoComponent)).componentInstance as FormularioDoPontoComponent).formulario;
  }

  function enviar(): void {
    (elemento.querySelector('.formulario__enviar') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function preencherValido(): void {
    digitar('Nome do ponto', '  Ecoponto Morumbi ');
    digitar('Endereço', 'Rua das Flores, 100');
    escolherBairro('Morumbi');
    marcar('Plástico');
    marcar('Papel e papelão');
  }

  beforeEach(async () => {
    obter = jasmine.createSpy('get').and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));
    sugerir = jasmine.createSpy('sugerir').and.returnValue(of({} as PontoCriado));
    voltar = jasmine.createSpy('voltar');
    await TestBed.configureTestingModule({
      imports: [SugerirModule, RouterTestingModule],
      providers: [
        { provide: ApiService, useValue: { get: obter } },
        { provide: PontosService, useValue: { sugerir } },
        { provide: HistoricoService, useValue: { voltar } },
      ],
    }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    mostrar = spyOn(TestBed.inject(AvisoService), 'mostrar');
    fixture = TestBed.createComponent(PaginaSugerirComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('mostra os campos na ordem da D09, com os bairros e os materiais da API', () => {
    expect(textos('h1')).toEqual(['Sugerir novo ponto']);
    expect(textos('eco-campo-texto label, eco-seletor .seletor__rotulo')).toEqual([
      'Nome do ponto',
      'Endereço',
      'Bairro',
      'Horário (opcional)',
      'Contato (opcional)',
    ]);
    expect(textos('fieldset legend')).toEqual(['Materiais aceitos (obrigatório)']);
    expect(textos('eco-chip-material label')).toEqual(['Papel e papelão', 'Plástico', 'Pilhas e baterias']);
    expect(textos('.formulario__acoes button')).toEqual(['Cancelar', 'Enviar sugestão']);
  });

  it('enviar vazio mostra cada erro junto do campo, leva o foco ao primeiro e não chama a API', () => {
    enviar();

    expect(textos('.campo__erro, .seletor__erro, .formulario__erro')).toEqual([
      'Informe o nome do ponto.',
      'Informe o endereço.',
      'Escolha o bairro.',
      'Escolha pelo menos um material.',
    ]);
    expect(document.activeElement).toBe(elemento.querySelector('[data-campo="nome"] input'));
    expect(sugerir).not.toHaveBeenCalled();
  });

  it('sem material escolhido, o envio é bloqueado com a mensagem junto dos chips, e o foco vai para eles', () => {
    digitar('Nome do ponto', 'Ecoponto Morumbi');
    digitar('Endereço', 'Rua das Flores, 100');
    escolherBairro('Morumbi');
    enviar();

    expect(textos('#formulario-materiais-erro')).toEqual(['Escolha pelo menos um material.']);
    expect(elemento.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe('formulario-materiais-erro');
    expect(document.activeElement).toBe(caixa('Papel e papelão'));
    expect(sugerir).not.toHaveBeenCalled();

    marcar('Pilhas e baterias');
    expect(elemento.querySelector('#formulario-materiais-erro')).toBeNull();
  });

  it('os chips são caixas de seleção num grupo: marcar e desmarcar mudam o valor', () => {
    marcar('Pilhas e baterias');
    marcar('Papel e papelão');
    expect(caixa('Pilhas e baterias').checked).toBeTrue();
    expect(formulario().controls.categorias.value).toEqual([1, 6]);

    marcar('Pilhas e baterias');
    expect(caixa('Pilhas e baterias').checked).toBeFalse();
    expect(formulario().controls.categorias.value).toEqual([1]);
    expect(elemento.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe('formulario-materiais-ajuda');
  });

  it('um envio válido manda os textos limpos, os materiais em ordem e vai a Minhas sugestões com o aviso', async () => {
    preencherValido();
    enviar();
    await fixture.whenStable();

    expect(sugerir).toHaveBeenCalledOnceWith({
      nome: 'Ecoponto Morumbi',
      endereco: 'Rua das Flores, 100',
      idBairro: 13,
      horario: null,
      contato: null,
      categorias: [1, 2],
    });
    expect(navegar).toHaveBeenCalledOnceWith('/minhas-sugestoes');
    expect(mostrar).toHaveBeenCalledOnceWith(AVISO_DE_SUGESTAO_ENVIADA);
  });

  it('durante o envio, o botão diz "Enviando…", fica indisponível e um segundo envio é ignorado', () => {
    const resposta = new Subject<PontoCriado>();
    sugerir.and.returnValue(resposta);
    preencherValido();
    enviar();
    enviar();

    const botao = elemento.querySelector('.formulario__enviar') as HTMLButtonElement;
    expect(botao.textContent?.trim()).toBe('Enviando…');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(sugerir).toHaveBeenCalledTimes(1);
  });

  it('um 400 do backend põe cada erro no campo certo; editar o campo tira o erro', () => {
    sugerir.and.returnValue(
      throwError(() => new ErroApi(400, 'DADOS_INVALIDOS', 'Confira os campos.', { endereco: 'Este endereço já foi sugerido.', bairro: 'Bairro inválido.' })),
    );
    preencherValido();
    enviar();

    expect(textos('[data-campo="endereco"] .campo__erro')).toEqual(['Este endereço já foi sugerido.']);
    expect(textos('[data-campo="idBairro"] .seletor__erro')).toEqual(['Bairro inválido.']);
    expect(document.activeElement).toBe(elemento.querySelector('[data-campo="endereco"] input'));
    expect(elemento.querySelector('.formulario__aviso')).toBeNull();

    digitar('Endereço', 'Rua das Flores, 101');
    expect(elemento.querySelector('[data-campo="endereco"] .campo__erro')).toBeNull();
  });

  it('uma falha de rede não apaga o que foi digitado e oferece "Tentar de novo", que reenvia', async () => {
    sugerir.and.returnValue(throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor.')));
    preencherValido();
    enviar();

    expect(textos('.formulario__aviso[role="alert"] p')).toEqual(['Não foi possível falar com o servidor.']);
    expect((elemento.querySelector('[data-campo="nome"] input') as HTMLInputElement).value).toBe('  Ecoponto Morumbi ');
    expect(caixa('Plástico').checked).toBeTrue();
    expect(textos('[data-campo="idBairro"] [role="combobox"]')).toEqual(['Morumbi']);

    sugerir.and.returnValue(of({} as PontoCriado));
    (elemento.querySelector('.formulario__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(sugerir).toHaveBeenCalledTimes(2);
    expect(navegar).toHaveBeenCalledOnceWith('/minhas-sugestoes');
  });

  it('401: mostra a mensagem, sem "Tentar de novo" (o interceptor da sessão leva a Entrar)', () => {
    sugerir.and.returnValue(throwError(() => new ErroApi(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.')));
    preencherValido();
    enviar();
    expect(textos('.formulario__aviso p')).toEqual(['Entre na sua conta para continuar.']);
    expect(elemento.querySelector('.formulario__aviso button')).toBeNull();
  });

  it('se os bairros e materiais não carregam, avisa e tenta de novo', () => {
    fixture.destroy();
    obter.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    fixture = TestBed.createComponent(PaginaSugerirComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(textos('.formulario__aviso p')).toEqual(['Não foi possível carregar os bairros e os materiais. Fora do ar.']);

    const listas = new Subject<unknown>();
    obter.and.returnValue(listas);
    const botao = elemento.querySelector('.formulario__aviso button') as HTMLButtonElement;
    botao.focus();
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao);

    listas.error(new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.'));
    fixture.detectChanges();
    expect(document.activeElement).toBe(elemento.querySelector('.formulario__aviso button'));

    obter.and.callFake((rota: string) => of(rota === 'bairros' ? BAIRROS : CATEGORIAS));
    (elemento.querySelector('.formulario__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(elemento.querySelector('.formulario__aviso')).toBeNull();
    expect(textos('eco-chip-material label').length).toBe(3);
    expect(document.activeElement).toBe(elemento.querySelector('[data-campo="idBairro"] [role="combobox"]'));
  });

  it('"Tentar de novo" do envio leva o foco a "Enviar sugestão", que fica na tela enquanto envia', () => {
    sugerir.and.returnValue(throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.')));
    preencherValido();
    enviar();
    const resposta = new Subject<PontoCriado>();
    sugerir.and.returnValue(resposta);
    (elemento.querySelector('.formulario__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const botao = elemento.querySelector('.formulario__enviar') as HTMLButtonElement;
    expect(document.activeElement).toBe(botao);
    expect(botao.textContent?.trim()).toBe('Enviando…');

    resposta.error(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'));
    fixture.detectChanges();
    expect(document.activeElement).toBe(botao);
    expect(textos('.formulario__aviso p')).toEqual(['Sem conexão.']);
  });

  it('depois de criada, a sugestão não se repete: o formulário se esvazia antes de navegar', async () => {
    navegar.and.resolveTo(false);
    preencherValido();
    enviar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mostrar).toHaveBeenCalledOnceWith(AVISO_DE_SUGESTAO_ENVIADA);
    expect(formulario().getRawValue()).toEqual({
      nome: '',
      endereco: '',
      idBairro: null,
      horario: '',
      contato: '',
      categorias: [],
    });
    enviar();
    expect(sugerir).toHaveBeenCalledTimes(1);
  });

  it('um 400 sobre um campo que a pessoa já mudou durante o envio não fica preso no valor novo', () => {
    const resposta = new Subject<PontoCriado>();
    sugerir.and.returnValue(resposta);
    preencherValido();
    enviar();
    digitar('Endereço', 'Rua das Flores, 200');
    resposta.error(new ErroApi(400, 'DADOS_INVALIDOS', 'Confira.', { endereco: 'Endereço repetido.', nome: 'Nome repetido.' }));
    fixture.detectChanges();

    expect(elemento.querySelector('[data-campo="endereco"] .campo__erro')).toBeNull();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual(['Nome repetido.']);
  });

  it('texto longo demais (colado, por exemplo) não é cortado: mostra o limite junto do campo', () => {
    expect(elemento.querySelector('[data-campo="nome"] input')?.getAttribute('maxlength')).toBeNull();
    digitar('Nome do ponto', 'n'.repeat(130));
    enviar();
    expect(textos('[data-campo="nome"] .campo__erro')).toEqual(['Use até 120 caracteres.']);
    expect((elemento.querySelector('[data-campo="nome"] input') as HTMLInputElement).value.length).toBe(130);
  });

  it('os campos não puxam do navegador os dados pessoais de quem preenche, e os obrigatórios se anunciam', () => {
    const autocompletar = Array.from(elemento.querySelectorAll('eco-campo-texto input')).map((entrada) =>
      entrada.getAttribute('autocomplete'),
    );
    expect(autocompletar).toEqual(['off', 'off', 'off', 'off']);
    expect(elemento.querySelector('[data-campo="contato"] input')?.getAttribute('type')).toBe('text');
    expect(elemento.querySelector('[data-campo="idBairro"] [role="combobox"]')?.getAttribute('aria-required')).toBe('true');
    expect(textos('fieldset legend')).toEqual(['Materiais aceitos (obrigatório)']);
  });

  it('"Cancelar" volta à página anterior do EcoPonto, ou à busca', () => {
    (elemento.querySelector('.formulario__acoes button') as HTMLButtonElement).click();
    expect(voltar).toHaveBeenCalledOnceWith('/');
  });
});
