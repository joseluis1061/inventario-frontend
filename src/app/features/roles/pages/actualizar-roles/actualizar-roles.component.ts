import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, catchError, of, switchMap, debounceTime } from 'rxjs';

import { RolesService } from '../../../../core/services/roles.service';
import { RolUpdateRequest, RolResponse } from '../../../../core/models/rol.interface';
import { AuthService } from '../../../../core/services/auth-service.service';

@Component({
  selector: 'app-actualizar-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './actualizar-roles.component.html',
  styleUrl: './actualizar-roles.component.scss'
})
export class ActualizarRolesComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly rolesService = inject(RolesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  isLoadingRol = signal(true);
  formSubmitted = signal(false);
  nombreDisponible = signal<boolean | null>(null);
  checkingNombre = signal(false);
  rolOriginal = signal<RolResponse | null>(null);
  rolId = signal<number | null>(null);

  // FormGroup
  rolForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.rolesService.loadingStates;

  ngOnInit(): void {
    this.initializeForm();
    this.loadRolFromRoute();
    this.setupNombreValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar rol desde parámetros de ruta
   */
  private loadRolFromRoute(): void {
    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = Number(params['id']);
          this.rolId.set(id);

          if (!id || isNaN(id)) {
            this.router.navigate(['/roles']);
            return of(null);
          }

          return this.rolesService.obtenerPorId(id);
        }),
        catchError(error => {
          console.error('Error al cargar rol:', error);
          this.router.navigate(['/roles']);
          return of(null);
        })
      )
      .subscribe(rol => {
        this.isLoadingRol.set(false);

        if (rol) {
          this.rolOriginal.set(rol);
          this.populateForm(rol);
        } else {
          this.router.navigate(['/roles']);
        }
      });
  }

  /**
   * Llenar formulario con datos del rol
   */
  private populateForm(rol: RolResponse): void {
    this.rolForm.patchValue({
      nombre: rol.nombre,
      descripcion: rol.descripcion
    });
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
        const rolOriginal = this.rolOriginal();

        // No verificar si es el mismo nombre original
        if (rolOriginal && nombre === rolOriginal.nombre) {
          this.nombreDisponible.set(true);
          return;
        }

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
    const rolOriginal = this.rolOriginal();
    if (!rolOriginal) return;

    this.checkingNombre.set(true);

    this.rolesService.verificarNombreExiste(nombre, rolOriginal.id)
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
   * Verificar si hay cambios en el formulario
   */
  hasFormChanges(): boolean {
    const rolOriginal = this.rolOriginal();
    if (!rolOriginal) return false;

    const formValues = this.rolForm.value;
    return (
      formValues.nombre?.trim() !== rolOriginal.nombre ||
      (formValues.descripcion?.trim() || '') !== (rolOriginal.descripcion || '')
    );
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

    if (!this.hasFormChanges()) {
      // No hay cambios, regresar a la lista
      this.router.navigate(['/roles']);
      return;
    }

    const rolId = this.rolId();
    if (!rolId) return;

    this.isLoading.set(true);

    const rolData: RolUpdateRequest = {
      nombre: this.rolForm.get('nombre')?.value?.trim(),
      descripcion: this.rolForm.get('descripcion')?.value?.trim()
    };

    this.rolesService.actualizar(rolId, rolData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al actualizar rol:', error);
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
   * Resetear formulario a valores originales
   */
  onReset(): void {
    const rolOriginal = this.rolOriginal();
    if (rolOriginal) {
      this.populateForm(rolOriginal);
      this.formSubmitted.set(false);
      this.nombreDisponible.set(null);
    }
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
           !this.isLoading() &&
           !this.isLoadingRol() &&
           this.hasFormChanges();
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
   * Verificar si puede editar este rol
   */
  puedeEditar(): boolean {
    const rol = this.rolOriginal();
    if (!rol) return false;

    // No puede editar roles del sistema
    if (rol.esRolSistema) {
      return false;
    }

    // Solo admin puede editar roles
    return this.authService.isAdmin();
  }

  /**
   * Obtener título de la página
   */
  get pageTitle(): string {
    const rol = this.rolOriginal();
    return rol ? `Editar: ${rol.nombre}` : 'Editando Rol';
  }

  /**
   * Verificar si es un rol del sistema
   */
  get esRolSistema(): boolean {
    const rol = this.rolOriginal();
    return rol ? rol.esRolSistema : false;
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
   * Obtener vista previa del rol actualizado
   */
  get vistaPrevia(): any {
    const rolOriginal = this.rolOriginal();
    const nombre = this.rolForm.get('nombre')?.value?.trim();
    const descripcion = this.rolForm.get('descripcion')?.value?.trim();

    if (!rolOriginal || !nombre || !descripcion) return null;

    return {
      ...rolOriginal,
      nombre,
      descripcion,
      fechaActualizacion: new Date().toISOString()
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
   * Obtener icono sugerido para el rol
   */
  getRolIcono(nombre: string): string {
    const iconos: { [key: string]: string } = {
      'ADMIN': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      'GERENTE': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      'EMPLEADO': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      'SUPERVISOR': 'M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      'COORDINADOR': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      'ANALISTA': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
    };

    return iconos[nombre] || 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
  }

  /**
   * Formatear fecha de creación
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtener información del usuario que no puede editar
   */
  get mensajeRestriccion(): string {
    const rol = this.rolOriginal();
    if (!rol) return '';

    if (rol.esRolSistema) {
      return 'Los roles del sistema están protegidos y no pueden ser modificados para mantener la seguridad del sistema.';
    }

    if (!this.authService.isAdmin()) {
      return 'Solo los administradores pueden editar roles del sistema.';
    }

    return '';
  }
}
