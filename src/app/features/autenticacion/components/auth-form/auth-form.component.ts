import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth-service.service';
import { LoginRequest } from '../../../../core/models';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    A11yModule,
    OverlayModule
  ],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss'
})
export class AuthFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Signals para estado reactivo
  isLoading = signal(false);
  showPassword = signal(false);
  loginError = signal<string | null>(null);

  // FormGroup con validaciones
  loginForm!: FormGroup;

  ngOnInit(): void {
    this.initializeForm();
  }

  /**
   * Inicializar formulario con validaciones
   */
  private initializeForm(): void {
    this.loginForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(100)
      ]],
      rememberMe: [false]
    });
  }

  /**
   * Alternar visibilidad de contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  /**
   * Verificar si un campo específico tiene errores
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Obtener mensaje de error específico para un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} es obligatorio`;
      }
      if (field.errors['minlength']) {
        const minLength = field.errors['minlength'].requiredLength;
        return `${this.getFieldDisplayName(fieldName)} debe tener al menos ${minLength} caracteres`;
      }
      if (field.errors['maxlength']) {
        const maxLength = field.errors['maxlength'].requiredLength;
        return `${this.getFieldDisplayName(fieldName)} no puede exceder ${maxLength} caracteres`;
      }
    }

    return '';
  }

  /**
   * Obtener nombre display del campo para errores
   */
  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      username: 'Usuario',
      password: 'Contraseña'
    };
    return displayNames[fieldName] || fieldName;
  }

  /**
   * Manejar envío del formulario
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.loginError.set(null);

    const loginData: LoginRequest = {
      username: this.loginForm.get('username')?.value?.trim(),
      password: this.loginForm.get('password')?.value,
      rememberMe: this.loginForm.get('rememberMe')?.value || false,
      deviceInfo: this.getDeviceInfo()
    };

    this.authService.login(loginData)
      .pipe(
        catchError(error => {
          console.error('❌ Error en login:', error);
          this.handleLoginError(error);
          return of(null);
        }),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe(response => {
        if (response?.success) {
          console.log('✅ Login exitoso');
          this.handleLoginSuccess();
        }
      });
  }

  /**
   * Marcar todos los campos como touched para mostrar errores
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Obtener información del dispositivo
   */
  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;

    return `Web - ${platform} - ${language} - ${userAgent.substring(0, 50)}`;
  }

  /**
   * Manejar errores de login
   */
  private handleLoginError(error: any): void {
    let errorMessage = 'Error inesperado. Intenta nuevamente.';

    if (error?.status === 401) {
      errorMessage = 'Usuario o contraseña incorrectos';
    } else if (error?.status === 403) {
      errorMessage = 'Cuenta desactivada. Contacta al administrador.';
    } else if (error?.status === 429) {
      errorMessage = 'Demasiados intentos. Espera unos minutos.';
    } else if (error?.status === 0) {
      errorMessage = 'Error de conexión. Verifica tu internet.';
    } else if (error?.userMessage) {
      errorMessage = error.userMessage;
    }

    this.loginError.set(errorMessage);
  }

  /**
   * Manejar login exitoso
   */
  private handleLoginSuccess(): void {
    // Obtener URL de retorno si existe
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/dashboard';

    // Pequeño delay para mejor UX
    setTimeout(() => {
      this.router.navigate([returnUrl]);
    }, 500);
  }

  /**
   * Navegar a forgot password
   */
  goToForgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  /**
   * Limpiar errores cuando el usuario empiece a escribir
   */
  onFieldInput(): void {
    if (this.loginError()) {
      this.loginError.set(null);
    }
  }
}
