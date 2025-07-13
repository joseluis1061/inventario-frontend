import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualizarProductosComponent } from './actualizar-productos.component';

describe('ActualizarProductosComponent', () => {
  let component: ActualizarProductosComponent;
  let fixture: ComponentFixture<ActualizarProductosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualizarProductosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActualizarProductosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
