import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosEstadisticasComponent } from './movimientos-estadisticas.component';

describe('MovimientosEstadisticasComponent', () => {
  let component: MovimientosEstadisticasComponent;
  let fixture: ComponentFixture<MovimientosEstadisticasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosEstadisticasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosEstadisticasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
