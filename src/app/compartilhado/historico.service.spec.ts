import { Location } from '@angular/common';
import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { HistoricoService } from './historico.service';

describe('HistoricoService', () => {
  let servico: HistoricoService;
  let historico: Location;
  let router: Router;
  let eventos: Subject<unknown>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
    eventos = router.events as unknown as Subject<unknown>;
    historico = TestBed.inject(Location);
    servico = TestBed.inject(HistoricoService);
    spyOn(historico, 'back');
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('a posição vem do ɵrouterPageId da entrada; sem ele, é a primeira (0)', () => {
    const estado = spyOn(historico, 'getState');
    estado.and.returnValue({ navigationId: 5, ɵrouterPageId: 3 });
    expect(servico.posicao).toBe(3);
    expect(servico.haAnteriorDoSistema).toBeTrue();

    estado.and.returnValue(null);
    expect(servico.posicao).toBe(0);
    expect(servico.haAnteriorDoSistema).toBeFalse();
  });

  it('volta no histórico só se houver página do sistema antes; o navigationId não conta', () => {
    const estado = spyOn(historico, 'getState');
    estado.and.returnValue({ navigationId: 9, ɵrouterPageId: 0 });
    servico.voltar('/');
    expect(historico.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');

    eventos.next(new NavigationEnd(9, '/', '/'));
    estado.and.returnValue({ navigationId: 10, ɵrouterPageId: 1 });
    servico.voltar('/');
    expect(historico.back).toHaveBeenCalledTimes(1);
  });

  it('o segundo toque de um toque duplo não volta de novo; depois que a navegação termina, volta', () => {
    spyOn(historico, 'getState').and.returnValue({ navigationId: 4, ɵrouterPageId: 2 });
    servico.voltar('/');
    servico.voltar('/');
    expect(historico.back).toHaveBeenCalledTimes(1);

    eventos.next(new NavigationEnd(5, '/', '/'));
    servico.voltar('/');
    expect(historico.back).toHaveBeenCalledTimes(2);

    eventos.next(new NavigationCancel(6, '/', 'cancelada'));
    servico.voltar('/');
    expect(historico.back).toHaveBeenCalledTimes(3);
  });

  it('se a primeira navegação foi desviada por um guarda (Entrar), a entrada desviada não conta como página do sistema', () => {
    const estado = spyOn(historico, 'getState');
    eventos.next(new NavigationCancel(1, '/painel/categorias/nova', 'desviada para Entrar'));
    estado.and.returnValue({ navigationId: 2, ɵrouterPageId: 1 });
    eventos.next(new NavigationEnd(2, '/entrar', '/entrar'));
    expect(servico.haAnteriorDoSistema).toBeFalse();
    servico.voltar('/painel?aba=categorias');
    expect(historico.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/painel?aba=categorias');

    eventos.next(new NavigationCancel(3, '/painel', 'desviada'));
    estado.and.returnValue({ navigationId: 4, ɵrouterPageId: 2 });
    expect(servico.haAnteriorDoSistema).toBeTrue();
  });

  it('se a volta não termina, a trava sai sozinha', fakeAsync(() => {
    spyOn(historico, 'getState').and.returnValue({ navigationId: 4, ɵrouterPageId: 2 });
    servico.voltar('/');
    tick(2000);
    servico.voltar('/');
    expect(historico.back).toHaveBeenCalledTimes(2);
    flush();
  }));
});
