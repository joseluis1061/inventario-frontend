import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosHistorialComponent } from './movimientos-historial.component';

describe('MovimientosHistorialComponent', () => {
  let component: MovimientosHistorialComponent;
  let fixture: ComponentFixture<MovimientosHistorialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosHistorialComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosHistorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
