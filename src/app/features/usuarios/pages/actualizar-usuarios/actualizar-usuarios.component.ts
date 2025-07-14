import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, catchError, of, switchMap } from 'rxjs';

import { UsuariosService } from '../../../../core/services/usuarios.service';
import { UsuarioUpdateRequest, UsuarioResponse } from '../../../../core/models/usuario.interface';
import { AuthService } from '../../../../core/services/auth-service.service';

@Component({
  selector: 'app-actualizar-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './actualizar-usuarios.component.html'
})
export class ActualizarUsuariosComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  isLoadingUsuario = signal(true);
  formSubmitted = signal(false);
  usernameDisponible = signal<boolean | null>(null);
  checkingUsername = signal(false);
  usuarioOriginal = signal<UsuarioResponse | null>(null);
  usuarioId = signal<number | null>(null);
  showPasswordSection = signal(false);

  // FormGroup
  usuarioForm!: FormGroup;
  passwordForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.usuariosService.loadingStates;

  // Roles disponibles (hardcodeados por simplicidad, podrían venir de un servicio)
  roles = [
    { id: 1, nombre: 'ADMIN', descripcion: 'Administrador del sistema con acceso completo' },
    { id: 2, nombre: 'GERENTE', descripcion: 'Gerente con permisos de supervisión' },
    { id: 3, nombre: 'EMPLEADO', descripcion: 'Empleado con permisos básicos de consulta y registro' }
  ];

  ngOnInit(): void {
    this.initializeForms();
    this.loadUsuario();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar usuario desde la ruta
   */
  private loadUsuario(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = Number(params.get('id'));
          if (!id || isNaN(id)) {
            this.router.navigate(['/usuarios']);
            return of(null);
          }

          this.usuarioId.set(id);
          this.isLoadingUsuario.set(true);

          return this.usuariosService.obtenerPorId(id);
        }),
        catchError(error => {
          console.error('Error al cargar usuario:', error);
          this.router.navigate(['/usuarios']);
          return of(null);
        })
      )
      .subscribe(usuario => {
        this.isLoadingUsuario.set(false);

        if (usuario) {
          this.usuarioOriginal.set(usuario);
          this.populateForm(usuario);
        } else {
          this.router.navigate(['/usuarios']);
        }
      });
  }

  /**
   * Llenar formulario con datos del usuario
   */
  private populateForm(usuario: UsuarioResponse): void {
    this.usuarioForm.patchValue({
      username: usuario.username,
      nombreCompleto: usuario.nombreCompleto,
      email: usuario.email,
      rolId: usuario.rol.id,
      activo: usuario.activo
    });

    // Marcar como disponible el username original
    this.usernameDisponible.set(true);
  }

  /**
   * Inicializar formularios con validaciones
   */
  private initializeForms(): void {
    // Formulario principal
    this.usuarioForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9_.-]+$/)
      ]],
      nombreCompleto: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(100)
      ]],
      rolId: ['', [
        Validators.required
      ]],
      activo: [true]
    });

    // Formulario de contraseña separado
    this.passwordForm = this.fb.group({
      passwordActual: ['', [
        Validators.required,
        Validators.minLength(6)
      ]],
      passwordNuevo: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(50),
        this.passwordComplexityValidator
      ]],
      confirmPasswordNuevo: ['', [
        Validators.required
      ]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Verificar disponibilidad del username cuando cambia
    this.usuarioForm.get('username')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(username => {
        if (username && username.trim().length >= 3) {
          this.verificarUsernameDisponible(username.trim());
        } else {
          this.usernameDisponible.set(null);
        }
      });
  }

  /**
   * Validador personalizado para complejidad de contraseña
   */
  private passwordComplexityValidator(control: any) {
    if (!control.value) return null;

    const password = control.value;
    const hasMinLength = password.length >= 6;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (hasMinLength && hasLetter && hasNumber) {
      return null;
    }

    return { complexity: true };
  }

  /**
   * Validador para confirmación de contraseña
   */
  private passwordMatchValidator(group: FormGroup) {
    const password = group.get('passwordNuevo')?.value;
    const confirmPassword = group.get('confirmPasswordNuevo')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }

  /**
   * Verificar si el username está disponible
   */
  private verificarUsernameDisponible(username: string): void {
    const usuarioOriginal = this.usuarioOriginal();

    // Si es el mismo username que tenía originalmente, es válido
    if (usuarioOriginal && username.trim().toLowerCase() === usuarioOriginal.username.toLowerCase()) {
      this.usernameDisponible.set(true);
      return;
    }

    if (this.checkingUsername()) return;

    this.checkingUsername.set(true);
    this.usernameDisponible.set(null);

    this.usuariosService.buscarPorUsername(username)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          // Si retorna 404, significa que no existe (disponible)
          if (error.message.includes('no encontrado')) {
            this.usernameDisponible.set(true);
          } else {
            this.usernameDisponible.set(null);
          }
          return of(null);
        })
      )
      .subscribe(usuario => {
        // Si encuentra un usuario, no está disponible
        this.usernameDisponible.set(usuario ? false : true);
        this.checkingUsername.set(false);
      });
  }

  /**
   * Verificar errores de campo específico
   */
  hasFieldError(fieldName: string, formGroup: FormGroup = this.usuarioForm): boolean {
    const field = formGroup.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(fieldName: string, formGroup: FormGroup = this.usuarioForm): string {
    const field = formGroup.get(fieldName);

    if (!field || !field.errors) return '';

    const errors = field.errors;

    switch (fieldName) {
      case 'username':
        if (errors['required']) return 'El username es obligatorio';
        if (errors['minlength']) return 'El username debe tener al menos 3 caracteres';
        if (errors['maxlength']) return 'El username no puede exceder 50 caracteres';
        if (errors['pattern']) return 'Solo se permiten letras, números, puntos, guiones y guiones bajos';
        break;

      case 'nombreCompleto':
        if (errors['required']) return 'El nombre completo es obligatorio';
        if (errors['minlength']) return 'El nombre debe tener al menos 2 caracteres';
        if (errors['maxlength']) return 'El nombre no puede exceder 100 caracteres';
        if (errors['pattern']) return 'Solo se permiten letras y espacios';
        break;

      case 'email':
        if (errors['required']) return 'El email es obligatorio';
        if (errors['email']) return 'Ingresa un email válido';
        if (errors['maxlength']) return 'El email no puede exceder 100 caracteres';
        break;

      case 'passwordActual':
        if (errors['required']) return 'La contraseña actual es obligatoria';
        if (errors['minlength']) return 'Ingresa la contraseña actual';
        break;

      case 'passwordNuevo':
        if (errors['required']) return 'La nueva contraseña es obligatoria';
        if (errors['minlength']) return 'La contraseña debe tener al menos 6 caracteres';
        if (errors['maxlength']) return 'La contraseña no puede exceder 50 caracteres';
        if (errors['complexity']) return 'La contraseña debe contener al menos una letra y un número';
        break;

      case 'confirmPasswordNuevo':
        if (errors['required']) return 'Confirma la nueva contraseña';
        break;

      case 'rolId':
        if (errors['required']) return 'Debes seleccionar un rol';
        break;
    }

    // Error de coincidencia de contraseñas
    if (fieldName === 'confirmPasswordNuevo' && this.passwordForm.errors?.['passwordMismatch']) {
      return 'Las contraseñas no coinciden';
    }

    return '';
  }

  /**
   * Obtener estado del campo username (para mostrar íconos)
   */
  getUsernameFieldState(): 'valid' | 'invalid' | 'checking' | 'neutral' {
    const usernameControl = this.usuarioForm.get('username');

    if (this.checkingUsername()) return 'checking';
    if (!usernameControl?.value || usernameControl.value.trim().length < 3) return 'neutral';
    if (this.hasFieldError('username')) return 'invalid';
    if (this.usernameDisponible() === false) return 'invalid';
    if (this.usernameDisponible() === true) return 'valid';

    return 'neutral';
  }

  /**
   * Obtener mensaje para disponibilidad del username
   */
  getUsernameAvailabilityMessage(): string {
    if (this.checkingUsername()) return 'Verificando disponibilidad...';
    if (this.usernameDisponible() === true) return 'Username disponible';
    if (this.usernameDisponible() === false) return 'Este username ya está en uso';
    return '';
  }

  /**
   * Verificar si hay cambios en el formulario principal
   */
  hasFormChanges(): boolean {
    const usuarioOriginal = this.usuarioOriginal();
    if (!usuarioOriginal) return false;

    const formValues = this.usuarioForm.value;
    return (
      formValues.username?.trim() !== usuarioOriginal.username ||
      formValues.nombreCompleto?.trim() !== usuarioOriginal.nombreCompleto ||
      formValues.email?.trim() !== usuarioOriginal.email ||
      Number(formValues.rolId) !== usuarioOriginal.rol.id ||
      formValues.activo !== usuarioOriginal.activo
    );
  }

  /**
   * Verificar si las contraseñas nuevas coinciden
   */
  passwordsMatch(): boolean {
    const password = this.passwordForm.get('passwordNuevo')?.value;
    const confirmPassword = this.passwordForm.get('confirmPasswordNuevo')?.value;

    return password && confirmPassword && password === confirmPassword;
  }

  /**
   * Obtener fortaleza de la contraseña nueva
   */
  getPasswordStrength(): { level: number; text: string; color: string } {
    const password = this.passwordForm.get('passwordNuevo')?.value || '';

    if (!password) return { level: 0, text: '', color: '' };

    let score = 0;

    // Longitud
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;

    // Complejidad
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    if (score <= 2) return { level: score, text: 'Débil', color: 'red' };
    if (score <= 4) return { level: score, text: 'Media', color: 'yellow' };
    return { level: score, text: 'Fuerte', color: 'green' };
  }

  /**
   * Alternar sección de cambio de contraseña
   */
  togglePasswordSection(): void {
    this.showPasswordSection.update(show => !show);
    if (!this.showPasswordSection()) {
      this.passwordForm.reset();
    }
  }

  /**
   * Enviar formulario principal
   */
  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.usuarioForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    if (this.usernameDisponible() === false) {
      return;
    }

    if (!this.hasFormChanges()) {
      // No hay cambios, regresar a la lista
      this.router.navigate(['/usuarios']);
      return;
    }

    const usuarioId = this.usuarioId();
    if (!usuarioId) return;

    this.isLoading.set(true);

    const usuarioData: UsuarioUpdateRequest = {
      username: this.usuarioForm.get('username')?.value?.trim(),
      nombreCompleto: this.usuarioForm.get('nombreCompleto')?.value?.trim(),
      email: this.usuarioForm.get('email')?.value?.trim(),
      activo: this.usuarioForm.get('activo')?.value,
      rolId: Number(this.usuarioForm.get('rolId')?.value)
    };

    this.usuariosService.actualizar(usuarioId, usuarioData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al actualizar usuario:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(usuario => {
        this.isLoading.set(false);

        if (usuario) {
          // Actualizar usuario original con los nuevos datos
          this.usuarioOriginal.set(usuario);
          this.populateForm(usuario);

          // Si no hay cambio de contraseña pendiente, navegar de vuelta
          if (!this.showPasswordSection() || this.passwordForm.pristine) {
            this.router.navigate(['/usuarios']);
          }
        }
      });
  }

  /**
   * Cambiar contraseña
   */
  onSubmitPassword(): void {
    if (this.passwordForm.invalid) {
      this.markAllFieldsAsTouched(this.passwordForm);
      return;
    }

    const usuarioId = this.usuarioId();
    if (!usuarioId) return;

    const passwordActual = this.passwordForm.get('passwordActual')?.value;
    const passwordNuevo = this.passwordForm.get('passwordNuevo')?.value;

    this.usuariosService.cambiarPassword(usuarioId, passwordActual, passwordNuevo)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cambiar contraseña:', error);
          return of(null);
        })
      )
      .subscribe(() => {
        // Limpiar formulario de contraseña
        this.passwordForm.reset();
        this.showPasswordSection.set(false);
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/usuarios']);
  }

  /**
   * Resetear formulario a valores originales
   */
  onReset(): void {
    const usuarioOriginal = this.usuarioOriginal();
    if (usuarioOriginal) {
      this.populateForm(usuarioOriginal);
      this.formSubmitted.set(false);
    }
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(formGroup: FormGroup = this.usuarioForm): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.usuarioForm.valid &&
           this.usernameDisponible() === true &&
           !this.checkingUsername() &&
           !this.isLoading() &&
           !this.isLoadingUsuario() &&
           this.hasFormChanges();
  }

  /**
   * Verificar si el formulario de contraseña está listo
   */
  get isPasswordFormReady(): boolean {
    return this.passwordForm.valid && !this.loadingStates().changingPassword;
  }

  /**
   * Verificar si mostrar el botón de guardar
   */
  get showSubmitButton(): boolean {
    const usernameControl = this.usuarioForm.get('username');
    const nombreControl = this.usuarioForm.get('nombreCompleto');
    return !!(usernameControl?.value && usernameControl.value.trim().length >= 3 &&
              nombreControl?.value && nombreControl.value.trim().length >= 2);
  }

  /**
   * Obtener rol seleccionado
   */
  getRolSeleccionado(): any {
    const rolId = this.usuarioForm.get('rolId')?.value;
    if (!rolId) return null;

    return this.roles.find(rol => rol.id === Number(rolId)) || null;
  }

  /**
   * Generar iniciales a partir del nombre completo
   */
  generarIniciales(): string {
    const nombreCompleto = this.usuarioForm.get('nombreCompleto')?.value || '';
    const nombres = nombreCompleto.trim().split(' ');

    if (nombres.length >= 2) {
      return `${nombres[0][0]}${nombres[1][0]}`.toUpperCase();
    } else if (nombres.length === 1 && nombres[0].length >= 2) {
      return nombres[0].substring(0, 2).toUpperCase();
    }

    return 'US';
  }

  /**
   * Verificar si puede editar este usuario
   */
  puedeEditar(): boolean | null {
    const usuario = this.usuarioOriginal();
    if (!usuario) return false;

    // No puede editar admin principal
    if (usuario.esAdminPrincipal) {
      return false;
    }

    // Solo admin puede editar otros usuarios, pero cualquiera puede editar su propio perfil
    const currentUser = this.authService.getCurrentUser();
    const esPropio = currentUser && currentUser.id === usuario.id;

    return this.authService.isAdmin() || esPropio;
  }

  /**
   * Verificar si puede cambiar el rol
   */
  puedeCambiarRol(): boolean {
    const usuario = this.usuarioOriginal();
    if (!usuario) return false;

    // Solo admin puede cambiar roles y no puede cambiar el rol del admin principal
    return this.authService.isAdmin() && !usuario.esAdminPrincipal;
  }

  /**
   * Verificar si puede cambiar el estado activo
   */
  puedeCambiarEstado(): boolean {
    const usuario = this.usuarioOriginal();
    if (!usuario) return false;

    // No puede cambiar estado del admin principal ni su propio estado
    const currentUser = this.authService.getCurrentUser();
    const esPropio = currentUser && currentUser.id === usuario.id;

    return this.authService.isAdmin() && !usuario.esAdminPrincipal && !esPropio;
  }

  /**
   * Obtener título de la página
   */
  get pageTitle(): string {
    const usuario = this.usuarioOriginal();
    return usuario ? `Editar: ${usuario.nombreCompleto}` : 'Editando Usuario';
  }

  /**
   * Verificar si es el usuario actual
   */
  get esUsuarioActual(): boolean {
    const usuario = this.usuarioOriginal();
    const currentUser = this.authService.getCurrentUser();
    return usuario && currentUser ? currentUser.id === usuario.id : false;
  }
}
