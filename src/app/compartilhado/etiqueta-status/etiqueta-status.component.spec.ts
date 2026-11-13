import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EtiquetaStatusComponent, StatusDoPonto } from './etiqueta-status.component';

describe('EtiquetaStatusComponent', () => {
  let fixture: ComponentFixture<EtiquetaStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [EtiquetaStatusComponent] }).compileComponents();
    fixture = TestBed.createComponent(EtiquetaStatusComponent);
  });

  it('mostra o texto do Figma e a cor de cada status', () => {
    const esperado: Record<StatusDoPonto, string> = {
      PENDENTE: 'Pendente',
      APROVADO: 'Aprovado',
      RECUSADO: 'Recusado',
    };
    for (const status of ['PENDENTE', 'APROVADO', 'RECUSADO'] as const) {
      fixture = TestBed.createComponent(EtiquetaStatusComponent);
      fixture.componentInstance.status = status;
      fixture.detectChanges();
      const elemento = fixture.nativeElement as HTMLElement;
      expect(elemento.textContent?.trim()).toBe(esperado[status]);
      expect(elemento.classList).toContain(`etiqueta--${status.toLowerCase()}`);
    }
  });

  it('aceita outro texto quando a tela pede', () => {
    fixture.componentInstance.status = 'APROVADO';
    fixture.componentInstance.rotulo = 'Aprovada';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('Aprovada');
  });
});
