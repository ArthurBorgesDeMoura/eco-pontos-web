import { ChangeDetectorRef, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { ErroApi, traduzirErro } from '../../api/erro-api';
import { TrocaDeTelaService } from '../../compartilhado/troca-de-tela.service';
import { SessaoService } from '../../sessao/sessao.service';
import { destinoSeguro } from './destino';
import { CampoDeAcesso, ErrosDeAcesso, MENSAGEM, temErros } from './validacao-de-acesso';

@Directive()
export abstract class FormularioDeAcesso implements OnDestroy {
  protected readonly sessao = inject(SessaoService);
  protected readonly router = inject(Router);
  protected readonly rota = inject(ActivatedRoute);
  private readonly troca = inject(TrocaDeTelaService);
  private readonly elemento: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly mudancas = inject(ChangeDetectorRef);

  tentouEnviar = false;
  enviando = false;
  erroGeral: string | null = null;
  private errosDoServidor: ErrosDeAcesso = {};
  private envio?: Subscription;

  protected abstract readonly campos: readonly CampoDeAcesso[];
  protected abstract validar(): ErrosDeAcesso;
  protected abstract executar(): Observable<unknown>;

  get voltar(): string | null {
    return this.rota.snapshot.queryParamMap.get('voltar');
  }

  get parametrosDoVoltar(): Record<string, string> | null {
    const voltar = this.voltar;
    return voltar ? { voltar } : null;
  }

  erroDo(campo: CampoDeAcesso): string | null {
    return this.errosDoServidor[campo] ?? (this.tentouEnviar ? this.validar()[campo] : undefined) ?? null;
  }

  enviar(): void {
    if (this.enviando) {
      return;
    }
    this.tentouEnviar = true;
    this.erroGeral = null;
    this.errosDoServidor = {};
    if (temErros(this.validar())) {
      this.focarPrimeiroErro();
      return;
    }
    this.enviando = true;
    this.envio = this.executar().subscribe({
      next: () => this.irAoDestino(),
      error: (erro: unknown) => this.tratarErro(traduzirErro(erro)),
    });
  }

  ngOnDestroy(): void {
    this.envio?.unsubscribe();
  }

  protected acompanhar(controles: Partial<Record<CampoDeAcesso, AbstractControl>>): void {
    for (const [campo, controle] of Object.entries(controles) as [CampoDeAcesso, AbstractControl][]) {
      controle.valueChanges.subscribe(() => {
        if (this.errosDoServidor[campo]) {
          const resto = { ...this.errosDoServidor };
          delete resto[campo];
          this.errosDoServidor = resto;
        }
      });
    }
  }

  protected irAoDestino(): void {
    this.troca.esmaecerProxima();
    this.router.navigateByUrl(destinoSeguro(this.voltar), { replaceUrl: true }).then(
      (navegou) => {
        if (!navegou) {
          this.desistirDaNavegacao();
        }
      },
      () => this.desistirDaNavegacao(),
    );
  }

  private desistirDaNavegacao(): void {
    this.troca.consumir();
    this.enviando = false;
  }

  private tratarErro(erro: ErroApi): void {
    this.enviando = false;
    if (erro.status === 409) {
      this.errosDoServidor = { email: erro.campos['email'] ?? MENSAGEM.emailRepetido };
    } else if (erro.status === 400) {
      const porCampo: ErrosDeAcesso = {};
      for (const campo of this.campos) {
        if (erro.campos[campo]) {
          porCampo[campo] = erro.campos[campo];
        }
      }
      this.errosDoServidor = porCampo;
      if (!temErros(porCampo)) {
        this.erroGeral = erro.mensagem;
      }
    } else {
      this.erroGeral = erro.mensagem;
    }
    if (temErros(this.errosDoServidor)) {
      this.focarPrimeiroErro();
    }
  }

  private focarPrimeiroErro(): void {
    this.mudancas.detectChanges();
    this.elemento.nativeElement.querySelector<HTMLElement>('input[aria-invalid="true"]')?.focus();
  }
}
