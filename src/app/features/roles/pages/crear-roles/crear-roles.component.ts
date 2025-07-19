import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of, debounceTime } from 'rxjs';

import { RolesService } from '../../../../core/services/roles.service';
import { RolCreateRequest } from '../../../../core/models/rol.interface';

@Component({
  selector: 'app-crear-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-roles.component.html',
  styleUrl: './crear-roles.component.scss'
})
export class CrearRolesComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly rolesService = inject(RolesService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  formSubmitted = signal(false);
  nombreDisponible = signal<boolean | null>(null);
  checkingNombre = signal(false);

  // FormGroup
  rolForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.rolesService.loadingStates;

  ngOnInit(): void {
    this.initializeForm();
    this.setupNombreValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario con validaciones
   */
  private initializeForm(): void {
    this.rolForm = this.fb.group({
      nombre: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Z][A-Z0-9_]*$/) // Solo mayúsculas, números y guiones bajos
      ]],
      descripcion: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(255)
      ]]
    });
  }

  /**
   * Configurar validación de nombre en tiempo real
   */
  private setupNombreValidation(): void {
    const nombreControl = this.rolForm.get('nombre');
    if (!nombreControl) return;

    nombreControl.valueChanges
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(nombre => {
        if (nombre && nombre.trim().length >= 2 && nombreControl.valid) {
          this.verificarNombreDisponible(nombre.trim());
        } else {
          this.nombreDisponible.set(null);
        }
      });
  }

  /**
   * Verificar si el nombre del rol está disponible
   */
  private verificarNombreDisponible(nombre: string): void {
    this.checkingNombre.set(true);

    this.rolesService.verificarNombreExiste(nombre)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al verificar nombre:', error);
          this.nombreDisponible.set(null);
          return of(true);
        })
      )
      .subscribe(existe => {
        this.nombreDisponible.set(!existe);
        this.checkingNombre.set(false);
      });
  }

  /**
   * Verificar si un campo tiene errores específicos
   */
  hasFieldError(field: string, errorType: string): boolean {
    const control = this.rolForm.get(field);
    return !!(control?.hasError(errorType) && (control?.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(field: string): string {
    const control = this.rolForm.get(field);
    if (!control || !control.errors || (!control.touched && !this.formSubmitted())) {
      return '';
    }

    const errors = control.errors;

    switch (field) {
      case 'nombre':
        if (errors['required']) return 'El nombre del rol es obligatorio';
        if (errors['minlength']) return 'El nombre debe tener al menos 2 caracteres';
        if (errors['maxlength']) return 'El nombre no puede exceder 50 caracteres';
        if (errors['pattern']) return 'Solo se permiten mayúsculas, números y guiones bajos';
        break;

      case 'descripcion':
        if (errors['required']) return 'La descripción es obligatoria';
        if (errors['minlength']) return 'La descripción debe tener al menos 10 caracteres';
        if (errors['maxlength']) return 'La descripción no puede exceder 255 caracteres';
        break;
    }

    return '';
  }

  /**
   * Convertir nombre a mayúsculas automáticamente
   */
  onNombreInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.toUpperCase();
    this.rolForm.patchValue({ nombre: valor });
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.rolForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    if (this.nombreDisponible() === false) {
      return;
    }

    this.isLoading.set(true);

    const rolData: RolCreateRequest = {
      nombre: this.rolForm.get('nombre')?.value?.trim(),
      descripcion: this.rolForm.get('descripcion')?.value?.trim()
    };

    this.rolesService.crear(rolData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al crear rol:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(rol => {
        this.isLoading.set(false);

        if (rol) {
          // Navegar de vuelta a la lista de roles
          this.router.navigate(['/roles']);
        }
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/roles']);
  }

  /**
   * Resetear formulario
   */
  onReset(): void {
    this.rolForm.reset();
    this.formSubmitted.set(false);
    this.nombreDisponible.set(null);
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.rolForm.controls).forEach(key => {
      this.rolForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.rolForm.valid &&
           this.nombreDisponible() === true &&
           !this.checkingNombre() &&
           !this.isLoading();
  }

  /**
   * Verificar si mostrar el botón de guardar
   */
  get showSubmitButton(): boolean {
    const nombreControl = this.rolForm.get('nombre');
    const descripcionControl = this.rolForm.get('descripcion');
    return !!(nombreControl?.value && nombreControl.value.trim().length >= 2 &&
              descripcionControl?.value && descripcionControl.value.trim().length >= 10);
  }

  /**
   * Obtener estado del nombre para mostrar indicadores
   */
  get nombreEstado(): 'checking' | 'available' | 'unavailable' | 'neutral' {
    if (this.checkingNombre()) return 'checking';
    if (this.nombreDisponible() === true) return 'available';
    if (this.nombreDisponible() === false) return 'unavailable';
    return 'neutral';
  }

  /**
   * Generar sugerencias de nombres de rol
   */
  generarSugerenciaNombre(): void {
    const sugerencias = [
      'SUPERVISOR',
      'COORDINADOR',
      'ANALISTA',
      'ESPECIALISTA',
      'OPERADOR',
      'ASISTENTE',
      'JEFE_AREA',
      'SUB_GERENTE'
    ];

    const nombreRandom = sugerencias[Math.floor(Math.random() * sugerencias.length)];
    this.rolForm.patchValue({ nombre: nombreRandom });
  }

  /**
   * Generar descripción automática basada en el nombre
   */
  generarDescripcionAuto(): void {
    const nombre = this.rolForm.get('nombre')?.value;
    if (!nombre) return;

    const descripciones: { [key: string]: string } = {
      'SUPERVISOR': 'Supervisor con permisos de supervisión y control de procesos operativos',
      'COORDINADOR': 'Coordinador responsable de gestionar equipos y procesos específicos',
      'ANALISTA': 'Analista con permisos de consulta, análisis y generación de reportes',
      'ESPECIALISTA': 'Especialista con conocimientos técnicos en área específica',
      'OPERADOR': 'Operador con permisos básicos para realizar tareas operativas',
      'ASISTENTE': 'Asistente con permisos de apoyo y consulta de información',
      'JEFE_AREA': 'Jefe de área con permisos de gestión y supervisión de departamento',
      'SUB_GERENTE': 'Sub-gerente con permisos amplios de gestión y toma de decisiones'
    };

    const descripcionAuto = descripciones[nombre] ||
                           `Rol personalizado ${nombre.toLowerCase()} con permisos específicos del sistema`;

    this.rolForm.patchValue({ descripcion: descripcionAuto });
  }

  /**
   * Contar caracteres restantes para descripción
   */
  get caracteresRestantesDescripcion(): number {
    const descripcion = this.rolForm.get('descripcion')?.value || '';
    return 255 - descripcion.length;
  }

  /**
   * Obtener clase CSS para el indicador de caracteres
   */
  get claseContadorCaracteres(): string {
    const restantes = this.caracteresRestantesDescripcion;
    if (restantes < 20) return 'text-red-600';
    if (restantes < 50) return 'text-yellow-600';
    return 'text-neutral-500';
  }

  /**
   * Obtener vista previa del rol que se va a crear
   */
  get vistaPrevia(): any {
    const nombre = this.rolForm.get('nombre')?.value?.trim();
    const descripcion = this.rolForm.get('descripcion')?.value?.trim();

    if (!nombre || !descripcion) return null;

    return {
      nombre,
      descripcion,
      esRolSistema: false,
      estadoTexto: 'Disponible',
      fechaCreacion: new Date().toISOString()
    };
  }

  /**
   * Verificar si el nombre sigue las convenciones
   */
  get nombreSigueConvenciones(): boolean {
    const nombre = this.rolForm.get('nombre')?.value;
    if (!nombre) return false;

    // Debe estar en mayúsculas, sin espacios, puede tener guiones bajos
    return /^[A-Z][A-Z0-9_]*$/.test(nombre);
  }

  /**
   * Obtener icono sugerido para el rol
   */
  getRolIcono(nombre: string): string {
    const iconos: { [key: string]: string } = {
      'SUPERVISOR': 'M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      'COORDINADOR': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      'ANALISTA': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
    };

    return iconos[nombre] || 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
  }
}
