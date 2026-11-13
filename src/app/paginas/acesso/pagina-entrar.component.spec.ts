import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { ErroApi } from '../../api/erro-api';
import { Usuario } from '../../api/modelos';
import { TrocaDeTelaService } from '../../compartilhado/troca-de-tela.service';
import { SessaoService } from '../../sessao/sessao.service';
import { AcessoModule } from './acesso.module';
import { PaginaEntrarComponent } from './pagina-entrar.component';
import { MENSAGEM } from './validacao-de-acesso';

const MARIA: Usuario = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

describe('PaginaEntrarComponent', () => {
  let fixture: ComponentFixture<PaginaEntrarComponent>;
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

  function enviar(): void {
    elemento.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function erroDe(rotulo: string): string | null {
    const id = campo(rotulo).getAttribute('aria-describedby');
    return campo(rotulo).getAttribute('aria-invalid') === 'true' && id
      ? (elemento.querySelector(`#${id}`)?.textContent?.trim() ?? null)
      : null;
  }

  function botao(): HTMLButtonElement {
    return elemento.querySelector('button[type="submit"]') as HTMLButtonElement;
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
    fixture = TestBed.createComponent(PaginaEntrarComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('tem o título, os campos com rótulo e o link para criar conta', () => {
    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Entrar');
    expect(campo('E-mail')).toBeTruthy();
    expect(campo('Senha')).toBeTruthy();
    expect(elemento.querySelector('a')?.getAttribute('href')).toBe('/criar-conta');
  });

  it('a senha fica escondida e os campos têm o preenchimento automático certo', () => {
    expect(campo('E-mail').type).toBe('email');
    expect(campo('E-mail').getAttribute('autocomplete')).toBe('username');
    expect(campo('E-mail').getAttribute('name')).toBe('email');
    expect(campo('Senha').type).toBe('password');
    expect(campo('Senha').getAttribute('autocomplete')).toBe('current-password');
  });

  it('enviar vazio mostra o erro de cada campo, põe o foco no primeiro e não chama a API', () => {
    expect(erroDe('E-mail')).toBeNull();
    enviar();

    expect(erroDe('E-mail')).toBe(MENSAGEM.emailVazio);
    expect(erroDe('Senha')).toBe(MENSAGEM.senhaVazia);
    expect(document.activeElement).toBe(campo('E-mail'));
    expect(sessao.entrar).not.toHaveBeenCalled();
  });

  it('e-mail inválido mostra o erro dele; corrigir o campo tira o erro na hora', () => {
    digitar('E-mail', 'maria.souza');
    digitar('Senha', 'senha-segura');
    enviar();
    expect(erroDe('E-mail')).toBe(MENSAGEM.emailInvalido);
    expect(erroDe('Senha')).toBeNull();

    digitar('E-mail', 'maria.souza@example.com');
    expect(erroDe('E-mail')).toBeNull();
  });

  it('dados válidos: entra e vai à busca', () => {
    sessao.entrar.and.returnValue(of(MARIA));
    const troca = TestBed.inject(TrocaDeTelaService);
    digitar('E-mail', 'maria.souza@example.com');
    digitar('Senha', 'senha-segura');
    enviar();

    expect(sessao.entrar).toHaveBeenCalledOnceWith('maria.souza@example.com', 'senha-segura');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/', { replaceUrl: true });
    expect(troca.consumir()).withContext('a busca entra esmaecendo').toBeTrue();
  });

  it('com ?voltar=, vai à tela pedida; com um endereço de fora, vai à busca', () => {
    sessao.entrar.and.returnValue(of(MARIA));
    parametros = { voltar: '/sugerir' };
    digitar('E-mail', 'maria.souza@example.com');
    digitar('Senha', 'senha-segura');
    enviar();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/sugerir', { replaceUrl: true });

    fixture.componentInstance.enviando = false;
    parametros = { voltar: '//outro-site.com' };
    enviar();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('login errado (401) mostra a mensagem única do backend no aviso, sem erro nos campos', () => {
    sessao.entrar.and.returnValue(
      throwError(() => new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.')),
    );
    digitar('E-mail', 'maria.souza@example.com');
    digitar('Senha', 'errada');
    enviar();

    expect(elemento.querySelector('[role="alert"]')?.textContent?.trim()).toBe('E-mail ou senha incorretos.');
    expect(erroDe('E-mail')).toBeNull();
    expect(erroDe('Senha')).toBeNull();
    expect(botao().textContent?.trim()).toBe('Entrar');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('enquanto envia, o botão diz "Entrando…", fica indisponível sem perder o foco e ignora outro envio', () => {
    const resposta = new Subject<Usuario>();
    sessao.entrar.and.returnValue(resposta);
    digitar('E-mail', 'maria.souza@example.com');
    digitar('Senha', 'senha-segura');
    botao().focus();
    enviar();
    enviar();

    expect(botao().textContent?.trim()).toBe('Entrando…');
    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(botao().disabled).toBeFalse();
    expect(document.activeElement).toBe(botao());
    expect(sessao.entrar).toHaveBeenCalledTimes(1);

    resposta.next(MARIA);
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('quem sai da tela durante o envio não é levado a lugar nenhum quando a resposta chega', () => {
    const resposta = new Subject<Usuario>();
    sessao.entrar.and.returnValue(resposta);
    digitar('E-mail', 'maria.souza@example.com');
    digitar('Senha', 'senha-segura');
    enviar();

    fixture.destroy();
    resposta.next(MARIA);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('depois de um 401 no meio do uso, avisa que a sessão terminou', () => {
    parametros = { motivo: 'sessao', voltar: '/sugerir' };
    fixture.detectChanges();

    expect(elemento.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Sua sessão terminou. Entre de novo para continuar.',
    );
  });

  it('vindo do Criar conta com a conta criada, mostra o aviso para entrar', () => {
    parametros = { conta: 'criada' };
    fixture.detectChanges();

    expect(elemento.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Conta criada. Entre com seu e-mail e senha.',
    );
  });
});
