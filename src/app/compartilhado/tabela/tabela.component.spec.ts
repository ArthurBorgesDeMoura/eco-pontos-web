import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompartilhadoModule } from '../compartilhado.module';

interface Linha {
  nome: string;
  bairro: string;
  endereco: string;
  materiais: string;
  detalhe?: string;
}

@Component({
  template: `
    <eco-tabela
      legenda="Pontos aprovados"
      [itens]="itens"
      [total]="total"
      mensagemVazia="Nenhum ponto aprovado."
      [carregando]="carregando"
      [textoDoResumo]="textoDoResumo"
      [itensSaindo]="saindo"
      (mostrarMais)="pedidos = pedidos + 1"
    >
      <ng-template ecoColuna="Ponto" let-ponto>
        <eco-celula-ponto
          [nome]="ponto.nome"
          [bairro]="ponto.bairro"
          [endereco]="ponto.endereco"
          [detalhe]="ponto.detalhe ?? ''"
        ></eco-celula-ponto>
      </ng-template>
      <ng-template ecoColuna="Materiais" largura="larga" let-ponto>{{ ponto.materiais }}</ng-template>
      <ng-template ecoColuna="Ações" largura="acoes" let-ponto>
        <button eco-botao type="button" tipo="texto" tamanho="p">Editar</button>
        <button eco-botao type="button" tipo="texto" tamanho="p">Excluir</button>
      </ng-template>
    </eco-tabela>
  `,
})
class HospedeiroComponent {
  itens: Linha[] = [
    {
      nome: 'Pão de Açúcar',
      bairro: 'Altamira',
      endereco: 'Av. Nicomedes Alves dos Santos, 2222',
      materiais: 'Óleo de cozinha usado',
    },
    { nome: 'Bretas - Loja 518', bairro: 'Centro', endereco: 'Av. João Pinheiro, 77', materiais: 'Lâmpadas' },
  ];
  total: number | null = 13;
  carregando = false;
  textoDoResumo: string | null = null;
  saindo: Linha[] = [];
  pedidos = 0;
}

describe('TabelaComponent', () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let elemento: HTMLElement;

  function textos(seletor: string): string[] {
    return Array.from(elemento.querySelectorAll<HTMLElement>(seletor)).map((item) =>
      item.innerText.replace(/\s+/g, ' ').trim(),
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompartilhadoModule],
      declarations: [HospedeiroComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComponent);
    elemento = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('é uma tabela nativa com legenda e os títulos das colunas', () => {
    expect(elemento.querySelector('table caption')?.textContent?.trim()).toBe('Pontos aprovados');
    expect(textos('thead th[scope="col"]')).toEqual(['Ponto', 'Materiais', 'Ações']);
  });

  it('desenha uma linha por item com os modelos das colunas', () => {
    expect(elemento.querySelectorAll('tbody tr').length).toBe(2);
    expect(textos('tbody tr:first-child td')).toEqual([
      'Pão de Açúcar Altamira · Av. Nicomedes Alves dos Santos, 2222',
      'Óleo de cozinha usado',
      'Editar Excluir',
    ]);
  });

  it('o rodapé diz quantos aparecem e "Mostrar mais" pede a próxima página', () => {
    expect(textos('.tabela__resumo')).toEqual(['Mostrando 2 de 13 pontos']);
    const mostrarMais = elemento.querySelector('.tabela__rodape button') as HTMLButtonElement;
    expect(mostrarMais.textContent?.trim()).toBe('Mostrar mais');

    mostrarMais.click();
    expect(fixture.componentInstance.pedidos).toBe(1);
  });

  it('carregando, o "Mostrar mais" fica com o foco e não pede de novo; quando acaba, o foco vai ao resumo', () => {
    const mostrarMais = elemento.querySelector('.tabela__rodape button') as HTMLButtonElement;
    mostrarMais.focus();
    mostrarMais.click();
    fixture.componentInstance.carregando = true;
    fixture.detectChanges();

    expect(mostrarMais.getAttribute('aria-disabled')).toBe('true');
    expect(mostrarMais.disabled).toBeFalse();
    expect(document.activeElement).toBe(mostrarMais);
    mostrarMais.click();
    expect(fixture.componentInstance.pedidos).toBe(1);

    const linha = fixture.componentInstance.itens[0];
    fixture.componentInstance.itens = Array.from({ length: 13 }, () => linha);
    fixture.componentInstance.carregando = false;
    fixture.detectChanges();
    expect(elemento.querySelector('.tabela__rodape button')).toBeNull();
    expect(document.activeElement).toBe(elemento.querySelector('.tabela__resumo'));
    expect(textos('.tabela__resumo')).toEqual(['Mostrando 13 de 13 pontos']);
  });

  it('sem mais itens, some o "Mostrar mais"; no singular, diz "ponto"', () => {
    fixture.componentInstance.itens = fixture.componentInstance.itens.slice(0, 1);
    fixture.componentInstance.total = 1;
    fixture.detectChanges();

    expect(textos('.tabela__resumo')).toEqual(['Mostrando 1 de 1 ponto']);
    expect(elemento.querySelector('.tabela__rodape button')).toBeNull();
  });

  it('a célula Ponto ganha a terceira linha só quando há o detalhe (D12)', () => {
    expect(elemento.querySelector('.celula__detalhe')).toBeNull();
    fixture.componentInstance.itens = [
      { ...fixture.componentInstance.itens[0], detalhe: 'Horário: não informado · Contato: não informado' },
      fixture.componentInstance.itens[1],
    ];
    fixture.detectChanges();
    expect(textos('.celula__detalhe')).toEqual(['Horário: não informado · Contato: não informado']);
  });

  it('o rodapé pode trocar "Mostrando 2 de 13" por outro texto (D12), mantendo o "Mostrar mais"', () => {
    fixture.componentInstance.textoDoResumo = '13 sugestões aguardando análise';
    fixture.detectChanges();
    expect(textos('.tabela__resumo')).toEqual(['13 sugestões aguardando análise']);
    expect(elemento.querySelector('.tabela__rodape button')).not.toBeNull();
  });

  it('a linha que está saindo ganha a classe do esmaecer e deixa de contar para o "Mostrar mais"', () => {
    const [primeira] = fixture.componentInstance.itens;
    fixture.componentInstance.total = 1;
    fixture.componentInstance.saindo = [primeira];
    fixture.detectChanges();
    const linhas = elemento.querySelectorAll('tbody tr');
    expect(linhas[0].classList).toContain('tabela__linha--saindo');
    expect(linhas[1].classList).not.toContain('tabela__linha--saindo');
    expect(elemento.querySelector('.tabela__rodape button')).toBeNull();

    fixture.componentInstance.total = 2;
    fixture.componentInstance.saindo = [primeira];
    fixture.detectChanges();
    expect(elemento.querySelector('.tabela__rodape button')).not.toBeNull();
  });

  it('sem itens, mostra a mensagem numa linha só; sem total, fica sem rodapé', () => {
    fixture.componentInstance.itens = [];
    fixture.componentInstance.total = null;
    fixture.detectChanges();

    const celula = elemento.querySelector('tbody td') as HTMLTableCellElement;
    expect(celula.textContent?.trim()).toBe('Nenhum ponto aprovado.');
    expect(celula.colSpan).toBe(3);
    expect(elemento.querySelector('.tabela__rodape')).toBeNull();
  });
});
