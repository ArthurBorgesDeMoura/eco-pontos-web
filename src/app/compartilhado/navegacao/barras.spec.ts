import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { PaginaDaBarra, PerfilDaBarra, destinosDoPerfil } from './navegacao';

@Component({
  template: `
    <eco-barra-superior [perfil]="perfil" [pagina]="pagina" [nome]="nome" (sair)="saidas = saidas + 1"></eco-barra-superior>
    <eco-cabecalho-celular
      [tipo]="tipo"
      [perfil]="perfil"
      [nome]="nome"
      titulo="Detalhes do ponto"
      (conta)="contas = contas + 1"
    ></eco-cabecalho-celular>
    <eco-barra-inferior [perfil]="perfil" [pagina]="pagina"></eco-barra-inferior>
  `,
})
class HospedeiroComponent {
  perfil: PerfilDaBarra = 'visitante';
  pagina: PaginaDaBarra | null = 'pontos';
  tipo: 'principal' | 'interna' = 'principal';
  nome = '';
  saidas = 0;
  contas = 0;
}

describe('Barras de navegação', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function usar(perfil: PerfilDaBarra, pagina: PaginaDaBarra | null, nome = ''): void {
    Object.assign(fixture.componentInstance, { perfil, pagina, nome });
    fixture.detectChanges();
  }

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll(seletor)).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function barraSuperior(): HTMLElement {
    return elemento.querySelector('eco-barra-superior') as HTMLElement;
  }

  function barraInferior(): HTMLElement {
    return elemento.querySelector('eco-barra-inferior') as HTMLElement;
  }

  function cabecalho(): HTMLElement {
    return elemento.querySelector('eco-cabecalho-celular') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule, RouterTestingModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('os destinos de cada perfil: nenhum, 1, 3 e 4', () => {
    expect(destinosDoPerfil('acesso').length).toBe(0);
    expect(destinosDoPerfil('visitante').map((destino) => destino.pagina)).toEqual(['pontos']);
    expect(destinosDoPerfil('usuario').map((destino) => destino.pagina)).toEqual(['pontos', 'sugerir', 'minhas']);
    expect(destinosDoPerfil('administrador').map((destino) => destino.pagina)).toEqual([
      'pontos',
      'sugerir',
      'minhas',
      'painel',
    ]);
  });

  describe('barra superior', () => {
    it('Acesso: só a marca, sem links nem botões', () => {
      usar('acesso', null);

      expect(barraSuperior().querySelector('nav')).toBeNull();
      expect(barraSuperior().querySelectorAll('button, a[eco-botao]').length).toBe(0);
      expect(textos('eco-barra-superior .barra__marca')).toEqual(['EcoPonto Uberlândia – MG']);
    });

    it('Visitante: Pontos de coleta, Entrar e Criar conta', () => {
      usar('visitante', 'pontos');

      expect(textos('eco-barra-superior nav a')).toEqual(['Pontos de coleta']);
      expect(textos('eco-barra-superior a[eco-botao]')).toEqual(['Entrar', 'Criar conta']);
      expect(barraSuperior().querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Pontos de coleta');
    });

    it('Usuário: os 3 links, o nome e "Sair"; o link da página fica ativo', () => {
      usar('usuario', 'sugerir', 'Maria Souza');

      expect(textos('eco-barra-superior nav a')).toEqual(['Pontos de coleta', 'Sugerir ponto', 'Minhas sugestões']);
      expect(barraSuperior().querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Sugerir ponto');
      expect(textos('eco-barra-superior .barra__nome')).toEqual(['Maria Souza']);
      expect(textos('eco-barra-superior eco-avatar')).toEqual(['M']);

      (barraSuperior().querySelector('button') as HTMLButtonElement).click();
      expect(fixture.componentInstance.saidas).toBe(1);
    });

    it('Administrador: os 4 links, com o Painel', () => {
      usar('administrador', 'painel', 'Administrador EcoPonto');

      expect(textos('eco-barra-superior nav a')).toEqual([
        'Pontos de coleta',
        'Sugerir ponto',
        'Minhas sugestões',
        'Painel',
      ]);
      expect(barraSuperior().querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Painel');
      expect(textos('eco-barra-superior eco-avatar')).toEqual(['A']);
    });

    it('os links levam às rotas das telas', () => {
      usar('administrador', 'pontos');

      expect(Array.from(barraSuperior().querySelectorAll('nav a')).map((link) => link.getAttribute('href'))).toEqual([
        '/',
        '/sugerir',
        '/minhas-sugestoes',
        '/painel',
      ]);
    });

    it('tem 64 px de altura, contando a linha de baixo', () => {
      usar('usuario', 'pontos', 'Maria Souza');

      expect(barraSuperior().getBoundingClientRect().height).toBe(64);
    });
  });

  describe('barra inferior do celular', () => {
    it('Usuário: 3 itens; Administrador: 4; com a página ativa marcada', () => {
      usar('usuario', 'minhas');
      expect(textos('eco-barra-inferior a')).toEqual(['Pontos', 'Sugerir', 'Minhas']);
      expect(barraInferior().querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Minhas');

      usar('administrador', 'painel');
      expect(textos('eco-barra-inferior a')).toEqual(['Pontos', 'Sugerir', 'Minhas', 'Painel']);
      expect(barraInferior().querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Painel');
    });

    it('Visitante e Acesso não têm barra inferior', () => {
      for (const perfil of ['visitante', 'acesso'] as const) {
        usar(perfil, null);
        expect(barraInferior().hidden).withContext(perfil).toBeTrue();
        expect(barraInferior().getBoundingClientRect().height).withContext(perfil).toBe(0);
      }
    });

    it('tem 84 px de altura, com itens de 60 px', () => {
      usar('usuario', 'pontos');

      expect(barraInferior().getBoundingClientRect().height).toBe(84);
      expect((barraInferior().querySelector('a') as HTMLElement).getBoundingClientRect().height).toBe(60);
    });
  });

  describe('cabeçalho do celular', () => {
    it('Principal do visitante: a marca sem a cidade e "Entrar"', () => {
      usar('visitante', 'pontos');

      expect(textos('eco-cabecalho-celular .cabecalho__marca')).toEqual(['EcoPonto']);
      const entrar = cabecalho().querySelector('a[eco-botao]') as HTMLAnchorElement;
      expect(entrar.textContent?.trim()).toBe('Entrar');
      expect(entrar.getAttribute('href')).toBe('/entrar');
      expect(cabecalho().getBoundingClientRect().height).toBe(56);
    });

    it('Principal na variante Acesso (Entrar e Criar conta): só a marca, sem "Entrar" nem avatar', () => {
      usar('acesso', null);

      expect(textos('eco-cabecalho-celular .cabecalho__marca')).toEqual(['EcoPonto']);
      expect(cabecalho().querySelector('a[eco-botao]')).toBeNull();
      expect(cabecalho().querySelector('button')).toBeNull();
    });

    it('Principal de quem está logado: o avatar num alvo de 44 px chamado "Conta"', () => {
      usar('usuario', 'pontos', 'Maria Souza');
      const conta = cabecalho().querySelector('button[aria-label="Conta"]') as HTMLButtonElement;

      expect(conta.textContent?.trim()).toBe('M');
      expect(conta.getBoundingClientRect().width).toBe(44);
      expect(conta.getBoundingClientRect().height).toBe(44);
      conta.click();
      expect(fixture.componentInstance.contas).toBe(1);
    });

    it('Interna: "Voltar" e o título; sem quem ouça, volta à página anterior do EcoPonto', () => {
      const historico = TestBed.inject(Location);
      spyOn(historico, 'back');
      spyOn(historico, 'getState').and.returnValue({ navigationId: 3, ɵrouterPageId: 2 });
      fixture.componentInstance.tipo = 'interna';
      fixture.detectChanges();

      const voltar = cabecalho().querySelector('button[aria-label="Voltar"]') as HTMLButtonElement;
      expect(voltar.querySelector('use')?.getAttribute('href')).toBe('assets/icones.svg#seta-esquerda');
      expect(textos('eco-cabecalho-celular .cabecalho__titulo')).toEqual(['Detalhes do ponto']);
      expect(cabecalho().querySelector('eco-marca')).toBeNull();

      voltar.click();
      expect(historico.back).toHaveBeenCalledTimes(1);
    });

    it('Interna: entrando por link direto ou aba nova, "Voltar" leva à busca, não para fora do site, mesmo depois de ir e voltar', () => {
      const historico = TestBed.inject(Location);
      const router = TestBed.inject(Router);
      spyOn(historico, 'back');
      spyOn(historico, 'getState').and.returnValue({ navigationId: 7, ɵrouterPageId: 0 });
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fixture.componentInstance.tipo = 'interna';
      fixture.detectChanges();

      (cabecalho().querySelector('button[aria-label="Voltar"]') as HTMLButtonElement).click();
      expect(historico.back).not.toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');
    });
  });
});
