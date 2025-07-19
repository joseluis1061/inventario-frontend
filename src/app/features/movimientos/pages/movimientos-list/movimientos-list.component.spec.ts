import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientosListComponent } from './movimientos-list.component';

describe('MovimientosListComponent', () => {
  let component: MovimientosListComponent;
  let fixture: ComponentFixture<MovimientosListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientosListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientosListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
