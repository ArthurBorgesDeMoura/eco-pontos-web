import { Provider } from '@angular/core';

import { environment } from '../../../environments/environment';
import { PROVEDOR_DA_SIMULACAO } from './simulacao.interceptor';

export const PROVEDORES_DA_SIMULACAO: Provider[] = environment.usarSimulacao ? [PROVEDOR_DA_SIMULACAO] : [];
