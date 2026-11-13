import { Injectable } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

import { Bairro, Categoria, ContagemDePontos, PontoResumo } from '../../api/modelos';
import { FiltrosDaBusca } from '../../api/pontos.service';
import { VersaoDosDadosService } from '../../api/versao-dos-dados.service';
import { HistoricoService } from '../../compartilhado/historico.service';

export interface FotoDaBusca {
  filtros: FiltrosDaBusca;
  pontos: PontoResumo[];
  total: number;
  paginaAtual: number;
  bairros: Bairro[];
  categorias: Categoria[];
  contagens: ContagemDePontos | null;
  rolagem: number;
  pontoAberto: number | null;
}

@Injectable({ providedIn: 'root' })
export class EstadoDaBuscaService {
  private readonly fotos = new Map<number, { foto: FotoDaBusca; versao: number }>();
  private inicio: { id: number; pelaVolta: boolean } | null = null;

  constructor(
    router: Router,
    historico: HistoricoService,
    private readonly versaoDosDados: VersaoDosDadosService,
  ) {
    router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        this.inicio = { id: evento.id, pelaVolta: evento.navigationTrigger === 'popstate' };
      } else if (evento instanceof NavigationEnd && this.inicio?.id === evento.id && !this.inicio.pelaVolta) {
        this.descartarDesde(historico.posicao);
      }
    });
  }

  guardar(posicao: number, foto: FotoDaBusca): void {
    this.fotos.set(posicao, { foto, versao: this.versaoDosDados.versao });
  }

  retomar(posicao: number, filtros: FiltrosDaBusca): FotoDaBusca | null {
    const guardada = this.fotos.get(posicao) ?? null;
    this.fotos.delete(posicao);
    if (!guardada || guardada.versao !== this.versaoDosDados.versao) {
      return null;
    }
    const { foto } = guardada;
    if (foto.filtros.bairro !== filtros.bairro || foto.filtros.categoria !== filtros.categoria) {
      return null;
    }
    return foto;
  }

  private descartarDesde(posicao: number): void {
    for (const chave of [...this.fotos.keys()]) {
      if (chave >= posicao) {
        this.fotos.delete(chave);
      }
    }
  }
}
