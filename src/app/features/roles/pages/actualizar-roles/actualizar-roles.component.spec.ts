import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualizarRolesComponent } from './actualizar-roles.component';

describe('ActualizarRolesComponent', () => {
  let component: ActualizarRolesComponent;
  let fixture: ComponentFixture<ActualizarRolesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualizarRolesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActualizarRolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
