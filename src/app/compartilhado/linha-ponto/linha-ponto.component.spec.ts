import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { CompartilhadoModule } from '../compartilhado.module';
import { linkDoMapa } from '../mapa';
import { LinhaPontoComponent } from './linha-ponto.component';

describe('LinhaPontoComponent', () => {
  let fixture: ComponentFixture<LinhaPontoComponent>;
  let linha: LinhaPontoComponent;
  let elemento: HTMLElement;

  function texto(seletor: string): string | undefined {
    return elemento.querySelector(seletor)?.textContent?.trim();
  }

  function linksDoMapa(): HTMLAnchorElement[] {
    return Array.from(elemento.querySelectorAll<HTMLAnchorElement>('a.linha__mapa'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CompartilhadoModule, RouterTestingModule] }).compileComponents();
    fixture = TestBed.createComponent(LinhaPontoComponent);
    linha = fixture.componentInstance;
    elemento = fixture.nativeElement as HTMLElement;
    linha.nome = 'Ecoponto Luizote de Freitas';
    linha.bairro = 'Luizote de Freitas';
    linha.endereco = 'Rua Wilson Gonçalves de Souza, 10';
    linha.materiais = ['Papel e papelão', 'Plástico', 'Metal'];
    fixture.detectChanges();
  });

  it('mostra nome, "Bairro · Endereço" e os materiais na ordem recebida', () => {
    expect(texto('.linha__nome')).toBe('Ecoponto Luizote de Freitas');
    expect(texto('.linha__local')).toBe('Luizote de Freitas · Rua Wilson Gonçalves de Souza, 10');
    expect(texto('.linha__materiais')).toBe('Papel e papelão, Plástico, Metal');
  });

  it('"Abrir no mapa" abre o Google Maps em outra aba, com o endereço codificado', () => {
    const esperado = linkDoMapa('Rua Wilson Gonçalves de Souza, 10', 'Luizote de Freitas');

    expect(linksDoMapa().length).toBe(2);
    for (const link of linksDoMapa()) {
      expect(link.href).toBe(esperado);
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Abrir no mapa de Ecoponto Luizote de Freitas (abre em outra aba)',
      );
    }
  });

  it('sem rota, o nome é só texto; com rota, é o link para os detalhes', () => {
    expect(elemento.querySelector('a.linha__nome')).toBeNull();

    fixture = TestBed.createComponent(LinhaPontoComponent);
    fixture.componentInstance.nome = 'Pão de Açúcar';
    fixture.componentInstance.rota = ['/pontos', 2];
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.linha__nome') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/pontos/2');
    expect(link.textContent?.trim()).toBe('Pão de Açúcar');
  });

  it('o layout troca de cartão para linha conforme a entrada', () => {
    expect(elemento.classList).toContain('linha--auto');

    linha.layout = 'cartao';
    fixture.detectChanges();
    expect(elemento.classList).toContain('linha--cartao');
    const [doDesktop, doCelular] = linksDoMapa();
    expect(getComputedStyle(doDesktop).display).toBe('none');
    expect(getComputedStyle(doCelular).display).not.toBe('none');

    linha.layout = 'linha';
    fixture.detectChanges();
    expect(getComputedStyle(doDesktop).display).not.toBe('none');
    expect(getComputedStyle(doCelular).display).toBe('none');
  });

  it('não insere texto como HTML', () => {
    fixture = TestBed.createComponent(LinhaPontoComponent);
    fixture.componentInstance.nome = '<img src=x onerror=alert(1)>';
    fixture.detectChanges();
    const nome = (fixture.nativeElement as HTMLElement).querySelector('.linha__nome') as HTMLElement;

    expect(nome.querySelector('img')).toBeNull();
    expect(nome.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('como esqueleto, mostra só barras: sem texto, sem link e fora do leitor de tela', () => {
    linha.esqueleto = true;
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect(elemento.getAttribute('aria-hidden')).toBe('true');
    expect(elemento.classList).toContain('linha--esqueleto');
    expect(elemento.querySelectorAll('.esqueleto-barra').length).toBe(3);
    expect(elemento.querySelectorAll('.esqueleto-vaga').length).toBe(2);
    expect(elemento.querySelector('a[href]')).toBeNull();
    expect(elemento.textContent).not.toContain('Ecoponto Luizote de Freitas');
  });
});
