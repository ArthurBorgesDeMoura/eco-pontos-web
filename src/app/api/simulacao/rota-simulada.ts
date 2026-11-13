import { HttpRequest } from '@angular/common/http';

export interface RespostaSimulada {
  status: number;
  corpo: unknown;
}

export interface RotaSimulada {
  metodo: string;
  caminho: RegExp;
  responder: (pedido: HttpRequest<unknown>) => RespostaSimulada;
}
