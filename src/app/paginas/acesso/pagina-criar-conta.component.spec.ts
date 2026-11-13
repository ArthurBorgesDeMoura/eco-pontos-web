import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { Usuario } from '../../api/modelos';
import { SessaoService } from '../../sessao/sessao.service';
import { AcessoModule } from './acesso.module';
import { PaginaCriarContaComponent } from './pagina-criar-conta.component';
import { MENSAGEM } from './validacao-de-acesso';

const ANA: Usuario = { idUsuario: 4, nome: 'Ana Lima', email: 'ana@example.com', perfil: 'USUARIO' };

describe('PaginaCriarContaComponent', () => {
  let fixture: ComponentFixture<PaginaCriarContaComponent>;
  let elemento: HTMLElement;
  let sessao: jasmine.SpyObj<SessaoService>;
  let router: Router;
  let parametros: Record<string, string>;

  function campo(rotulo: string): HTMLInputElement {
    const label = Array.from(elemento.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo);
    return elemento.querySelector(`#${label?.htmlFor}`) as HTMLInputElement;
  }

  function digitar(rotulo: string, valor: string): void {
    campo(rotulo).value = valor;
    campo(rotulo).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function preencher(): void {
    digitar('Nome', 'Ana Lima');
    digitar('E-mail', 'ana@example.com');
    digitar('Senha', 'senha-segura');
  }

  function enviar(): void {
    elemento.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function descricao(rotulo: string): string | null {
    const id = campo(rotulo).getAttribute('aria-describedby');
    return id ? (elemento.querySelector(`#${id}`)?.textContent?.trim() ?? null) : null;
  }

  beforeEach(async () => {
    parametros = {};
    sessao = jasmine.createSpyObj<SessaoService>('SessaoService', ['entrar', 'cadastrar', 'sair']);
    await TestBed.configureTestingModule({
      imports: [AcessoModule, RouterTestingModule],
      providers: [
        { provide: SessaoService, useValue: sessao },
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(parametros); } } } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PaginaCriarContaComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('pede nome, e-mail e senha, mostra a regra da senha (DA-3) e usa o preenchimento de senha nova', () => {
    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Criar conta');
    expect(campo('Nome').getAttribute('autocomplete')).toBe('name');
    expect(campo('Nome').maxLength).toBe(100);
    expect(campo('E-mail').getAttribute('autocomplete')).toBe('username');
    expect(campo('Senha').type).toBe('password');
    expect(campo('Senha').getAttribute('autocomplete')).toBe('new-password');
    expect(descricao('Senha')).toBe('Pelo menos 8 caracteres.');
  });

  it('senha curta mostra o erro no lugar da regra, com o foco na senha', () => {
    digitar('Nome', 'Ana Lima');
    digitar('E-mail', 'ana@example.com');
    digitar('Senha', '1234567');
    enviar();

    expect(descricao('Senha')).toBe(MENSAGEM.senhaCurta);
    expect(campo('Senha').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo('Senha'));
    expect(sessao.cadastrar).not.toHaveBeenCalled();
  });

  it('dados válidos: cria a conta, entra com os mesmos dados e vai à busca', () => {
    sessao.cadastrar.and.returnValue(of(ANA));
    sessao.entrar.and.returnValue(of(ANA));
    preencher();
    enviar();

    expect(sessao.cadastrar).toHaveBeenCalledOnceWith('Ana Lima', 'ana@example.com', 'senha-segura');
    expect(sessao.entrar).toHaveBeenCalledOnceWith('ana@example.com', 'senha-segura');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/', { replaceUrl: true });
  });

  it('e-mail repetido (409) mostra o erro no campo e-mail, com o foco nele', () => {
    sessao.cadastrar.and.returnValue(
      throwError(
        () =>
          new ErroApi(409, 'EMAIL_JA_CADASTRADO', 'Este e-mail já tem conta.', { email: 'Este e-mail já tem conta.' }),
      ),
    );
    preencher();
    enviar();

    expect(descricao('E-mail')).toBe('Este e-mail já tem conta.');
    expect(campo('E-mail').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo('E-mail'));
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
    expect(sessao.entrar).not.toHaveBeenCalled();

    digitar('E-mail', 'ana.lima@example.com');
    expect(campo('E-mail').getAttribute('aria-invalid')).toBeNull();
  });

  it('409 sem texto do campo usa a mensagem padrão de e-mail repetido', () => {
    sessao.cadastrar.and.returnValue(throwError(() => new ErroApi(409, 'CONFLITO', 'Conflito.')));
    preencher();
    enviar();

    expect(descricao('E-mail')).toBe(MENSAGEM.emailRepetido);
  });

  it('dados inválidos no servidor (400) vão para o campo de cada um', () => {
    sessao.cadastrar.and.returnValue(
      throwError(() => new ErroApi(400, 'DADOS_INVALIDOS', 'Confira os campos.', { nome: 'Nome inválido.' })),
    );
    preencher();
    enviar();

    expect(descricao('Nome')).toBe('Nome inválido.');
    expect(document.activeElement).toBe(campo('Nome'));
  });

  it('sem conexão, a mensagem vai para o aviso do topo e o botão volta ao normal', () => {
    sessao.cadastrar.and.returnValue(
      throwError(() => new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor.')),
    );
    preencher();
    enviar();

    expect(elemento.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Não foi possível falar com o servidor.');
    expect(elemento.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Criar conta');
  });

  it('se a conta foi criada mas a entrada falhou, leva a Entrar com o aviso, guardando o voltar', () => {
    parametros = { voltar: '/sugerir' };
    sessao.cadastrar.and.returnValue(of(ANA));
    sessao.entrar.and.returnValue(throwError(() => new ErroApi(503, 'SERVIDOR_INDISPONIVEL', 'Fora do ar.')));
    preencher();
    enviar();

    expect(router.navigate).toHaveBeenCalledOnceWith(['/entrar'], { queryParams: { conta: 'criada', voltar: '/sugerir' } });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
