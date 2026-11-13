import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

import { ROTA } from '../../rotas';
import { FormularioDeAcesso } from './formulario-de-acesso';
import { CampoDeAcesso, ErrosDeAcesso, TAMANHO_MAXIMO_DO_EMAIL, validarEntrada } from './validacao-de-acesso';

@Component({
  selector: 'eco-pagina-entrar',
  templateUrl: './pagina-entrar.component.html',
  styleUrls: ['./acesso.scss'],
})
export class PaginaEntrarComponent extends FormularioDeAcesso {
  readonly formulario = new FormGroup({
    email: new FormControl('', { nonNullable: true }),
    senha: new FormControl('', { nonNullable: true }),
  });
  readonly rotaCriarConta = ROTA.criarConta;
  readonly maximoDoEmail = TAMANHO_MAXIMO_DO_EMAIL;
  protected readonly campos: readonly CampoDeAcesso[] = ['email', 'senha'];

  constructor() {
    super();
    this.acompanhar(this.formulario.controls);
  }

  get sessaoTerminou(): boolean {
    return this.rota.snapshot.queryParamMap.get('motivo') === 'sessao';
  }

  get contaCriada(): boolean {
    return this.rota.snapshot.queryParamMap.get('conta') === 'criada';
  }

  protected validar(): ErrosDeAcesso {
    return validarEntrada(this.formulario.getRawValue());
  }

  protected executar(): Observable<unknown> {
    const { email, senha } = this.formulario.getRawValue();
    return this.sessao.entrar(email, senha);
  }
}
