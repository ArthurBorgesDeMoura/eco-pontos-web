import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { Usuario } from './api/modelos';
import { AppComponent } from './app.component';
import { CompartilhadoModule } from './compartilhado/compartilhado.module';
import { DialogoService } from './compartilhado/dialogo/dialogo.service';
import { TrocaDeTelaService } from './compartilhado/troca-de-tela.service';
import { SessaoService } from './sessao/sessao.service';

@Component({ template: '<main>Tela</main>' })
class TelaVaziaComponent {}

const MARIA: Usuario = { idUsuario: 2, nome: 'Maria Souza', email: 'maria.souza@example.com', perfil: 'USUARIO' };

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let elemento: HTMLElement;
  let router: Router;
  let usuario$: BehaviorSubject<Usuario | null>;
  let carregando: boolean;
  let sessao: Pick<SessaoService, 'usuario' | 'atual' | 'estaCarregando' | 'sair' | 'carregar'>;

  async function ir(caminho: string): Promise<void> {
    await fixture.ngZone?.run(() => router.navigateByUrl(caminho));
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  beforeEach(async () => {
    usuario$ = new BehaviorSubject<Usuario | null>(null);
    carregando = false;
    sessao = {
      usuario: usuario$.asObservable(),
      get atual() {
        return usuario$.value;
      },
      get estaCarregando() {
        return carregando;
      },
      carregar: jasmine.createSpy('carregar').and.returnValue(of(null)),
      sair: jasmine.createSpy('sair').and.callFake(() => {
        usuario$.next(null);
        return of(undefined);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [
        CompartilhadoModule,
        RouterTestingModule.withRoutes([
          { path: 'entrar', component: TelaVaziaComponent, data: { barras: 'acesso' } },
          { path: 'inicio', component: TelaVaziaComponent },
          { path: 'detalhe', component: TelaVaziaComponent, data: { cabecalhoInterno: 'Detalhes do ponto' } },
          { path: 'catalogo', component: TelaVaziaComponent, data: { barras: 'nenhuma' } },
          { path: '', component: TelaVaziaComponent },
        ]),
      ],
      declarations: [AppComponent, TelaVaziaComponent],
      providers: [{ provide: SessaoService, useValue: sessao }],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('outra tela começa do topo; trocar só a consulta da URL (os filtros) não mexe na rolagem', async () => {
    await ir('/inicio');
    const rolar = spyOn(window, 'scrollTo');

    await ir('/?bairro=4');
    expect(rolar).toHaveBeenCalledOnceWith(0, 0);
    rolar.calls.reset();
    await ir('/?bairro=4&material=6');
    expect(rolar).not.toHaveBeenCalled();
    await ir('/detalhe');
    expect(rolar).toHaveBeenCalledOnceWith(0, 0);
  });

  it('a rolagem fica com o sistema, não com o navegador', () => {
    expect(history.scrollRestoration).toBe('manual');
  });

  it('rota com cabecalhoInterno usa o cabeçalho Interno do celular, com o título', async () => {
    await ir('/detalhe');
    const cabecalho = elemento.querySelector('eco-cabecalho-celular') as HTMLElement;
    expect(cabecalho.classList).toContain('cabecalho--interna');
    expect(textos('eco-cabecalho-celular .cabecalho__titulo')).toEqual(['Detalhes do ponto']);
    expect(cabecalho.querySelector('button[aria-label="Voltar"]')).not.toBeNull();

    await ir('/inicio');
    expect((elemento.querySelector('eco-cabecalho-celular') as HTMLElement).classList).not.toContain('cabecalho--interna');
  });

  it('mostra a tela da rota, o aviso e o diálogo', async () => {
    await ir('/inicio');

    expect(elemento.querySelector('.tela router-outlet')).not.toBeNull();
    expect(elemento.querySelector('.tela main')?.textContent).toBe('Tela');
    expect(elemento.querySelector('eco-avisos')).not.toBeNull();
    expect(elemento.querySelector('eco-dialogos')).not.toBeNull();
  });

  it('ao abrir, pergunta ao backend quem está logado', () => {
    expect(sessao.carregar).toHaveBeenCalledTimes(1);
  });

  it('enquanto a sessão carrega, a barra fica sem itens de perfil, para não piscar', async () => {
    carregando = true;
    usuario$.next(null);
    await ir('/inicio');
    expect(elemento.querySelector('eco-barra-superior nav')).toBeNull();
    expect(elemento.querySelectorAll('eco-barra-superior [eco-botao], eco-cabecalho-celular [eco-botao]').length).toBe(0);

    carregando = false;
    usuario$.next(MARIA);
    fixture.detectChanges();
    expect(textos('eco-barra-superior .barra__nome')).toEqual(['Maria Souza']);
  });

  it('visitante: a barra do visitante e nenhuma barra inferior', async () => {
    await ir('/inicio');

    expect(textos('eco-barra-superior [eco-botao]')).toEqual(['Entrar', 'Criar conta']);
    expect(elemento.querySelector('eco-barra-inferior')).toBeNull();
  });

  it('logado: o nome na barra superior, o avatar no cabeçalho e a barra inferior do perfil', async () => {
    usuario$.next(MARIA);
    await ir('/inicio');

    expect(textos('eco-barra-superior .barra__nome')).toEqual(['Maria Souza']);
    expect(textos('eco-cabecalho-celular eco-avatar')).toEqual(['M']);
    expect(textos('eco-barra-inferior a')).toEqual(['Pontos', 'Sugerir', 'Minhas']);
    expect(elemento.querySelector('.tela')?.classList).toContain('tela--com-barra-inferior');

    usuario$.next({ ...MARIA, perfil: 'ADMIN' });
    fixture.detectChanges();
    expect(textos('eco-barra-inferior a')).toEqual(['Pontos', 'Sugerir', 'Minhas', 'Painel']);
  });

  it('Entrar e Criar conta usam a variante Acesso: só a marca', async () => {
    await ir('/entrar');

    expect(elemento.querySelector('eco-barra-superior nav')).toBeNull();
    expect(elemento.querySelectorAll('eco-barra-superior [eco-botao], eco-cabecalho-celular [eco-botao]').length).toBe(0);
  });

  it('o catálogo fica sem as barras', async () => {
    await ir('/catalogo');

    expect(elemento.querySelector('eco-barra-superior')).toBeNull();
    expect(elemento.querySelector('eco-cabecalho-celular')).toBeNull();
  });

  it('"Sair" encerra a sessão e volta à busca', async () => {
    usuario$.next(MARIA);
    await ir('/inicio');
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    (elemento.querySelector('eco-barra-superior button') as HTMLButtonElement).click();
    expect(sessao.sair).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('um clique duplo em "Sair" manda um pedido só', async () => {
    const resposta = new Subject<void>();
    (sessao.sair as jasmine.Spy).and.returnValue(resposta);
    usuario$.next(MARIA);
    await ir('/inicio');
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const sair = elemento.querySelector('eco-barra-superior button') as HTMLButtonElement;
    sair.click();
    sair.click();
    expect(sessao.sair).toHaveBeenCalledTimes(1);

    resposta.next();
    resposta.complete();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');
  });

  it('a tela pedida com esmaecer entra com ele, e só ela', fakeAsync(() => {
    TestBed.inject(TrocaDeTelaService).esmaecerProxima();
    void fixture.ngZone?.run(() => router.navigateByUrl('/inicio'));
    tick();
    fixture.detectChanges();
    expect(elemento.querySelector('.tela')?.classList).toContain('tela--esmaecer');

    tick(400);
    fixture.detectChanges();
    expect(elemento.querySelector('.tela')?.classList).not.toContain('tela--esmaecer');

    void fixture.ngZone?.run(() => router.navigateByUrl('/entrar'));
    tick();
    fixture.detectChanges();
    expect(elemento.querySelector('.tela')?.classList).not.toContain('tela--esmaecer');
  }));

  it('deixa a tela inerte só enquanto o diálogo está aberto', async () => {
    await ir('/inicio');
    const tela = elemento.querySelector('.tela') as HTMLElement;
    expect(tela.hasAttribute('inert')).toBeFalse();

    const dialogos = TestBed.inject(DialogoService);
    const resposta = dialogos.confirmar({ titulo: 'Excluir ponto?', texto: 'Não dá para desfazer.', confirmar: 'Excluir ponto' });
    fixture.detectChanges();
    expect(tela.hasAttribute('inert')).toBeTrue();

    dialogos.responder(false);
    fixture.detectChanges();
    expect(tela.hasAttribute('inert')).toBeFalse();
    expect(await resposta).toBeFalse();
  });
});
