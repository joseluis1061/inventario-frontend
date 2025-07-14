import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { UsuariosService } from '../../../../core/services/usuarios.service';
import { UsuarioCreateRequest } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-crear-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-usuarios.component.html'
})
export class CrearUsuariosComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  formSubmitted = signal(false);
  usernameDisponible = signal<boolean | null>(null);
  checkingUsername = signal(false);

  // FormGroup
  usuarioForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.usuariosService.loadingStates;

  // Roles disponibles (hardcodeados por simplicidad, podrían venir de un servicio)
  roles = [
    { id: 1, nombre: 'ADMIN', descripcion: 'Administrador del sistema con acceso completo' },
    { id: 2, nombre: 'GERENTE', descripcion: 'Gerente con permisos de supervisión' },
    { id: 3, nombre: 'EMPLEADO', descripcion: 'Empleado con permisos básicos de consulta y registro' }
  ];

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
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(50),
        this.passwordComplexityValidator
      ]],
      confirmPassword: ['', [
        Validators.required
      ]],
      rolId: ['', [
        Validators.required
      ]],
      activo: [true]
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
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }

  /**
   * Verificar si el username está disponible
   */
  private verificarUsernameDisponible(username: string): void {
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
  hasFieldError(fieldName: string): boolean {
    const field = this.usuarioForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.usuarioForm.get(fieldName);

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

      case 'password':
        if (errors['required']) return 'La contraseña es obligatoria';
        if (errors['minlength']) return 'La contraseña debe tener al menos 6 caracteres';
        if (errors['maxlength']) return 'La contraseña no puede exceder 50 caracteres';
        if (errors['complexity']) return 'La contraseña debe contener al menos una letra y un número';
        break;

      case 'confirmPassword':
        if (errors['required']) return 'Confirma la contraseña';
        break;

      case 'rolId':
        if (errors['required']) return 'Debes seleccionar un rol';
        break;
    }

    // Error de coincidencia de contraseñas
    if (fieldName === 'confirmPassword' && this.usuarioForm.errors?.['passwordMismatch']) {
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
   * Obtener fortaleza de la contraseña
   */
  getPasswordStrength(): { level: number; text: string; color: string } {
    const password = this.usuarioForm.get('password')?.value || '';

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
   * Enviar formulario
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

    this.isLoading.set(true);

    const usuarioData: UsuarioCreateRequest = {
      username: this.usuarioForm.get('username')?.value?.trim(),
      nombreCompleto: this.usuarioForm.get('nombreCompleto')?.value?.trim(),
      email: this.usuarioForm.get('email')?.value?.trim(),
      activo: this.usuarioForm.get('activo')?.value || true,
      rolId: Number(this.usuarioForm.get('rolId')?.value)
    };

    const password = this.usuarioForm.get('password')?.value;

    this.usuariosService.crear(usuarioData, password)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al crear usuario:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(usuario => {
        this.isLoading.set(false);

        if (usuario) {
          // Navegar de vuelta a la lista de usuarios
          this.router.navigate(['/usuarios']);
        }
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/usuarios']);
  }

  /**
   * Resetear formulario
   */
  onReset(): void {
    this.usuarioForm.reset({
      activo: true // Mantener activo por defecto
    });
    this.formSubmitted.set(false);
    this.usernameDisponible.set(null);
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.usuarioForm.controls).forEach(key => {
      this.usuarioForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.usuarioForm.valid &&
           this.usernameDisponible() === true &&
           !this.checkingUsername() &&
           !this.isLoading();
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
   * Verificar si las contraseñas coinciden
   */
  passwordsMatch(): boolean {
    const password = this.usuarioForm.get('password')?.value;
    const confirmPassword = this.usuarioForm.get('confirmPassword')?.value;

    return password && confirmPassword && password === confirmPassword;
  }
}
