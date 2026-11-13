import { Location } from '@angular/common';
import { Injectable } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';

const LIMITE_DA_VOLTA_MS = 2000;

@Injectable({ providedIn: 'root' })
export class HistoricoService {
  private voltando = false;
  private limite?: ReturnType<typeof setTimeout>;
  private primeira = 0;
  private primeiraTerminou = false;
  private primeiraDesviada = false;

  constructor(
    private readonly historico: Location,
    private readonly router: Router,
  ) {
    router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd || evento instanceof NavigationCancel || evento instanceof NavigationError) {
        this.soltar();
      }
      if (this.primeiraTerminou) {
        return;
      }
      if (evento instanceof NavigationCancel || evento instanceof NavigationError) {
        this.primeiraDesviada = true;
      } else if (evento instanceof NavigationEnd) {
        this.primeiraTerminou = true;
        this.primeira = this.primeiraDesviada ? this.posicao : 0;
      }
    });
  }

  get posicao(): number {
    const estado = this.historico.getState() as { ɵrouterPageId?: number } | null;
    return estado?.ɵrouterPageId ?? 0;
  }

  get haAnteriorDoSistema(): boolean {
    return this.posicao > this.primeira;
  }

  voltar(destino: string): void {
    if (this.voltando || this.router.getCurrentNavigation()) {
      return;
    }
    this.voltando = true;
    this.limite = setTimeout(() => this.soltar(), LIMITE_DA_VOLTA_MS);
    if (this.haAnteriorDoSistema) {
      this.historico.back();
    } else {
      void this.router.navigateByUrl(destino);
    }
  }

  private soltar(): void {
    this.voltando = false;
    clearTimeout(this.limite);
  }
}
