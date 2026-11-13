import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { PaginaNaoEncontradaComponent } from './pagina-nao-encontrada.component';
import { PaginaSemPermissaoComponent } from './pagina-sem-permissao.component';
import { SituacaoModule } from './situacao.module';

describe('Páginas de situação', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SituacaoModule, RouterTestingModule] }).compileComponents();
  });

  it('"Sem permissão" explica e leva de volta à busca', () => {
    const fixture = TestBed.createComponent(PaginaSemPermissaoComponent);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Sem permissão');
    expect(elemento.querySelector('p')?.textContent?.trim()).toBe('Esta tela é só para administradores.');
    const link = elemento.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Voltar à busca');
    expect(link.getAttribute('href')).toBe('/');
  });

  it('"Página não encontrada" explica e leva à busca', () => {
    const fixture = TestBed.createComponent(PaginaNaoEncontradaComponent);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Página não encontrada');
    const link = elemento.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Ir para a busca');
    expect(link.getAttribute('href')).toBe('/');
  });
});
