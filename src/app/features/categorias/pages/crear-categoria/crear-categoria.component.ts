import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { CategoriasService } from '../../../../core/services/categorias.service';
import { CategoriaCreateRequest } from '../../../../core/models/categoria.interface';

@Component({
  selector: 'app-crear-categoria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-categoria.component.html',
  styleUrl: './crear-categoria.component.scss'
})
export class CrearCategoriaComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly categoriasService = inject(CategoriasService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  formSubmitted = signal(false);
  nombreDisponible = signal<boolean | null>(null);
  checkingNombre = signal(false);

  // FormGroup
  categoriaForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.categoriasService.loadingStates;

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario con validaciones
   */
  private initializeForm(): void {
    this.categoriaForm = this.fb.group({
      nombre: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-_&.()]+$/)
      ]],
      descripcion: ['', [
        Validators.maxLength(255)
      ]]
    });

    // Verificar disponibilidad del nombre cuando cambia
    this.categoriaForm.get('nombre')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(nombre => {
        if (nombre && nombre.trim().length >= 2) {
          this.verificarNombreDisponible(nombre.trim());
        } else {
          this.nombreDisponible.set(null);
        }
      });
  }

  /**
   * Verificar si el nombre de categoría está disponible
   */
  private verificarNombreDisponible(nombre: string): void {
    if (this.checkingNombre()) return;

    this.checkingNombre.set(true);
    this.nombreDisponible.set(null);

    this.categoriasService.existe(nombre)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.nombreDisponible.set(null);
          return of(false);
        })
      )
      .subscribe(existe => {
        this.nombreDisponible.set(!existe);
        this.checkingNombre.set(false);
      });
  }

  /**
   * Verificar errores de campo específico
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.categoriaForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.categoriaForm.get(fieldName);

    if (!field || !field.errors) return '';

    const errors = field.errors;

    switch (fieldName) {
      case 'nombre':
        if (errors['required']) return 'El nombre es obligatorio';
        if (errors['minlength']) return 'El nombre debe tener al menos 2 caracteres';
        if (errors['maxlength']) return 'El nombre no puede exceder 100 caracteres';
        if (errors['pattern']) return 'El nombre contiene caracteres no válidos';
        break;

      case 'descripcion':
        if (errors['maxlength']) return 'La descripción no puede exceder 255 caracteres';
        break;
    }

    return '';
  }

  /**
   * Obtener estado del campo nombre (para mostrar íconos)
   */
  getNombreFieldState(): 'valid' | 'invalid' | 'checking' | 'neutral' {
    const nombreControl = this.categoriaForm.get('nombre');

    if (this.checkingNombre()) return 'checking';
    if (!nombreControl?.value || nombreControl.value.trim().length < 2) return 'neutral';
    if (this.hasFieldError('nombre')) return 'invalid';
    if (this.nombreDisponible() === false) return 'invalid';
    if (this.nombreDisponible() === true) return 'valid';

    return 'neutral';
  }

  /**
   * Obtener mensaje para disponibilidad del nombre
   */
  getNombreAvailabilityMessage(): string {
    if (this.checkingNombre()) return 'Verificando disponibilidad...';
    if (this.nombreDisponible() === true) return 'Nombre disponible';
    if (this.nombreDisponible() === false) return 'Este nombre ya está en uso';
    return '';
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.categoriaForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    if (this.nombreDisponible() === false) {
      return;
    }

    this.isLoading.set(true);

    const categoriaData: CategoriaCreateRequest = {
      nombre: this.categoriaForm.get('nombre')?.value?.trim(),
      descripcion: this.categoriaForm.get('descripcion')?.value?.trim() || ''
    };

    this.categoriasService.crear(categoriaData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al crear categoría:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(categoria => {
        this.isLoading.set(false);

        if (categoria) {
          // Navegar de vuelta a la lista de categorías
          this.router.navigate(['/categorias']);
        }
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/categorias']);
  }

  /**
   * Resetear formulario
   */
  onReset(): void {
    this.categoriaForm.reset();
    this.formSubmitted.set(false);
    this.nombreDisponible.set(null);
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.categoriaForm.controls).forEach(key => {
      this.categoriaForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.categoriaForm.valid &&
           this.nombreDisponible() === true &&
           !this.checkingNombre() &&
           !this.isLoading();
  }

  /**
   * Verificar si mostrar el botón de guardar
   */
  get showSubmitButton(): boolean {
    const nombreControl = this.categoriaForm.get('nombre');
    return !!(nombreControl?.value && nombreControl.value.trim().length >= 2);
  }
}
