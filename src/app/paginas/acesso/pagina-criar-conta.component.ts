import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { EMPTY, Observable, catchError, switchMap } from 'rxjs';

import { ROTA } from '../../rotas';
import { FormularioDeAcesso } from './formulario-de-acesso';
import {
  CampoDeAcesso,
  ErrosDeAcesso,
  TAMANHO_MAXIMO_DO_EMAIL,
  TAMANHO_MAXIMO_DO_NOME,
  TAMANHO_MINIMO_DA_SENHA,
  validarCadastro,
} from './validacao-de-acesso';

@Component({
  selector: 'eco-pagina-criar-conta',
  templateUrl: './pagina-criar-conta.component.html',
  styleUrls: ['./acesso.scss'],
})
export class PaginaCriarContaComponent extends FormularioDeAcesso {
  readonly formulario = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    senha: new FormControl('', { nonNullable: true }),
  });
  readonly rotaEntrar = ROTA.entrar;
  readonly maximoDoNome = TAMANHO_MAXIMO_DO_NOME;
  readonly maximoDoEmail = TAMANHO_MAXIMO_DO_EMAIL;
  readonly ajudaDaSenha = `Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  protected readonly campos: readonly CampoDeAcesso[] = ['nome', 'email', 'senha'];

  constructor() {
    super();
    this.acompanhar(this.formulario.controls);
  }

  protected validar(): ErrosDeAcesso {
    return validarCadastro(this.formulario.getRawValue());
  }

  protected executar(): Observable<unknown> {
    const { nome, email, senha } = this.formulario.getRawValue();
    return this.sessao.cadastrar(nome, email, senha).pipe(
      switchMap(() =>
        this.sessao.entrar(email, senha).pipe(
          catchError(() => {
            const queryParams: Record<string, string> = { conta: 'criada' };
            if (this.voltar) {
              queryParams['voltar'] = this.voltar;
            }
            void this.router.navigate([ROTA.entrar], { queryParams });
            return EMPTY;
          }),
        ),
      ),
    );
  }
}
