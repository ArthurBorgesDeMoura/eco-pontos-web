import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MudancasDoPainelService {
  private readonly excluido$ = new Subject<void>();
  readonly pontoExcluido: Observable<void> = this.excluido$.asObservable();

  avisarExclusao(): void {
    this.excluido$.next();
  }
}
