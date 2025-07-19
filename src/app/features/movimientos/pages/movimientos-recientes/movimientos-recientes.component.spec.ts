import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosRecientesComponent } from './movimientos-recientes.component';

describe('MovimientosRecientesComponent', () => {
  let component: MovimientosRecientesComponent;
  let fixture: ComponentFixture<MovimientosRecientesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosRecientesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosRecientesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
