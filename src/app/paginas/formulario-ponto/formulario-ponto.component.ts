import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { Observable, Subscription, forkJoin } from 'rxjs';

import { ApiService } from '../../api/api.service';
import { ErroApi, traduzirErro } from '../../api/erro-api';
import { Bairro, Categoria, NovaSugestao } from '../../api/modelos';
import { OpcaoDoSeletor } from '../../compartilhado/seletor/seletor.component';
import {
  CAMPOS_DA_SUGESTAO,
  CampoDaSugestao,
  DadosDaSugestao,
  ErrosDaSugestao,
  montarSugestao,
  temErrosNaSugestao,
  validarSugestao,
} from '../sugerir/validacao-da-sugestao';

const APELIDOS: Readonly<Record<string, CampoDaSugestao>> = { bairro: 'idBairro', materiais: 'categorias' };

const CONSULTA_DO_DESKTOP = '(min-width: 1024px)';

const SEM_NOVA_TENTATIVA: readonly number[] = [401, 403, 404];

@Component({
  selector: 'eco-formulario-ponto',
  templateUrl: './formulario-ponto.component.html',
  styleUrls: ['./cartao-do-formulario.scss', './formulario-ponto.component.scss'],
})
export class FormularioDoPontoComponent implements OnInit, OnDestroy {
  readonly formulario = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    endereco: new FormControl('', { nonNullable: true }),
    idBairro: new FormControl<number | null>(null),
    horario: new FormControl('', { nonNullable: true }),
    contato: new FormControl('', { nonNullable: true }),
    categorias: new FormControl<number[]>([], { nonNullable: true }),
  });

  @Input() set inicial(dados: DadosDaSugestao | null) {
    if (dados) {
      this.formulario.reset({ ...dados, categorias: [...dados.categorias] });
    }
  }

  @Input() rotuloDoEnvio = 'Enviar sugestão';
  @Input() rotuloEnviando = 'Enviando…';
  @Input() limparAoEnviar = false;
  @Input() enviarCom: ((corpo: NovaSugestao) => Observable<unknown>) | null = null;
  @Output() readonly enviado = new EventEmitter<unknown>();
  @Output() readonly cancelado = new EventEmitter<void>();

  opcoesDeBairro: OpcaoDoSeletor[] = [];
  categorias: Categoria[] = [];
  carregandoListas = true;
  erroDasListas: string | null = null;

  tentouEnviar = false;
  enviando = false;
  erroGeral: string | null = null;
  podeTentarDeNovo = false;
  tamanhoDosBotoes: 'm' | 'g' = 'g';

  private errosDoServidor: ErrosDaSugestao = {};
  private readonly inscricoes = new Subscription();
  private envio?: Subscription;
  private consultaDoDesktop?: MediaQueryList;
  private readonly aoMudarDeTamanho = (): void => this.medirTamanho();

  constructor(
    private readonly api: ApiService,
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly mudancas: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly documento: Document,
  ) {}

  ngOnInit(): void {
    this.carregarListas();
    for (const campo of CAMPOS_DA_SUGESTAO) {
      this.inscricoes.add(
        (this.formulario.controls[campo] as AbstractControl).valueChanges.subscribe(() => {
          if (this.errosDoServidor[campo]) {
            const resto = { ...this.errosDoServidor };
            delete resto[campo];
            this.errosDoServidor = resto;
          }
        }),
      );
    }
    this.consultaDoDesktop = this.documento.defaultView?.matchMedia(CONSULTA_DO_DESKTOP);
    this.consultaDoDesktop?.addEventListener('change', this.aoMudarDeTamanho);
    this.medirTamanho();
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
    this.envio?.unsubscribe();
    this.consultaDoDesktop?.removeEventListener('change', this.aoMudarDeTamanho);
  }

  erroDo(campo: CampoDaSugestao): string | null {
    return this.errosDoServidor[campo] ?? (this.tentouEnviar ? this.validar()[campo] : undefined) ?? null;
  }

  escolhida(idCategoria: number): boolean {
    return this.formulario.controls.categorias.value.includes(idCategoria);
  }

  alternar(idCategoria: number, ligado: boolean): void {
    const atuais = this.formulario.controls.categorias.value.filter((id) => id !== idCategoria);
    this.formulario.controls.categorias.setValue(ligado ? [...atuais, idCategoria].sort((a, b) => a - b) : atuais);
  }

  carregarListas(): void {
    if (this.carregandoListas && this.erroDasListas) {
      return;
    }
    const tentativa = this.erroDasListas !== null;
    this.carregandoListas = true;
    this.inscricoes.add(
      forkJoin({ bairros: this.api.get<Bairro[]>('bairros'), categorias: this.api.get<Categoria[]>('categorias') }).subscribe({
        next: ({ bairros, categorias }) => {
          this.opcoesDeBairro = bairros.map((bairro) => ({ valor: bairro.idBairro, rotulo: bairro.nome }));
          this.categorias = categorias;
          this.carregandoListas = false;
          this.erroDasListas = null;
          if (tentativa) {
            this.focar('[data-campo="idBairro"] [role="combobox"]');
          }
        },
        error: (erro: unknown) => {
          this.carregandoListas = false;
          this.erroDasListas = traduzirErro(erro).mensagem;
        },
      }),
    );
  }

  tentarEnviarDeNovo(): void {
    this.focar('.formulario__enviar');
    this.enviar();
  }

  enviar(): void {
    if (this.enviando || !this.enviarCom) {
      return;
    }
    this.tentouEnviar = true;
    this.erroGeral = null;
    this.podeTentarDeNovo = false;
    this.errosDoServidor = {};
    if (temErrosNaSugestao(this.validar())) {
      this.focarPrimeiroErro();
      return;
    }
    this.enviando = true;
    const enviados = this.dados();
    this.envio = this.enviarCom(montarSugestao(enviados)).subscribe({
      next: (resposta) => this.concluir(resposta),
      error: (erro: unknown) => this.tratarErro(traduzirErro(erro), enviados),
    });
  }

  liberar(): void {
    this.enviando = false;
    this.mudancas.markForCheck();
  }

  private dados(): DadosDaSugestao {
    return this.formulario.getRawValue();
  }

  private validar(): ErrosDaSugestao {
    return validarSugestao(this.dados());
  }

  private concluir(resposta: unknown): void {
    if (this.limparAoEnviar) {
      this.formulario.reset();
      this.tentouEnviar = false;
    }
    this.enviado.emit(resposta);
  }

  private tratarErro(erro: ErroApi, enviados: DadosDaSugestao): void {
    this.enviando = false;
    if (erro.status === 400) {
      const porCampo: ErrosDaSugestao = {};
      const atuais = this.dados();
      for (const [nome, mensagem] of Object.entries(erro.campos)) {
        const campo = (APELIDOS[nome] ?? (CAMPOS_DA_SUGESTAO as readonly string[]).find((item) => item === nome)) as
          | CampoDaSugestao
          | undefined;
        if (campo && JSON.stringify(atuais[campo]) === JSON.stringify(enviados[campo])) {
          porCampo[campo] = mensagem;
        }
      }
      this.errosDoServidor = porCampo;
      if (temErrosNaSugestao(porCampo)) {
        this.focarPrimeiroErro();
        return;
      }
      this.erroGeral = erro.mensagem;
      return;
    }
    this.erroGeral = erro.mensagem;
    this.podeTentarDeNovo = !SEM_NOVA_TENTATIVA.includes(erro.status);
  }

  private focarPrimeiroErro(): void {
    this.mudancas.detectChanges();
    const campo = CAMPOS_DA_SUGESTAO.find((item) => this.erroDo(item) !== null);
    if (!campo) {
      return;
    }
    this.focar(`[data-campo="${campo}"] input, [data-campo="${campo}"] [role="combobox"]`);
  }

  private focar(seletor: string): void {
    this.mudancas.detectChanges();
    this.elemento.nativeElement.querySelector<HTMLElement>(seletor)?.focus();
  }

  private medirTamanho(): void {
    this.tamanhoDosBotoes = this.consultaDoDesktop?.matches ? 'm' : 'g';
  }
}
