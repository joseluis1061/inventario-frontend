import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth-service.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LoadingService } from '../../../../core/services/loading.service';

@Component({
  selector: 'app-forgot-password',
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  // Signals para estado
  isLoading = signal(false);
  emailSent = signal(false);
  sentToEmail = signal('');

  // Form
  forgotForm!: FormGroup;

  ngOnInit(): void {
    this.initializeForm();
  }

  /**
   * Inicializar formulario
   */
  private initializeForm(): void {
    this.forgotForm = this.fb.group({
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(100)
      ]]
    });
  }

  /**
   * Verificar errores de campo
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.forgotForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Obtener mensaje de error
   */
  getFieldError(fieldName: string): string {
    const field = this.forgotForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) {
        return 'El correo electrónico es obligatorio';
      }
      if (field.errors['email']) {
        return 'Ingresa un correo electrónico válido';
      }
      if (field.errors['maxlength']) {
        return 'El correo electrónico es demasiado largo';
      }
    }

    return '';
  }

  /**
   * Enviar solicitud de recuperación
   */
  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    this.isLoading.set(true);
    const email = this.forgotForm.get('email')?.value?.trim();

    this.authService.forgotPassword(email)
      .pipe(
        catchError(error => {
          console.error('❌ Error en forgot password:', error);
          this.handleError(error);
          return of(null);
        }),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe(response => {
        if (response) {
          this.handleSuccess(email);
        }
      });
  }

  /**
   * Reenviar email
   */
  resendEmail(): void {
    const email = this.sentToEmail();
    if (email) {
      this.emailSent.set(false);
      this.forgotForm.patchValue({ email });
      this.onSubmit();
    }
  }

  /**
   * Ir al login
   */
  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.forgotForm.controls).forEach(key => {
      this.forgotForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Manejar éxito
   */
  private handleSuccess(email: string): void {
    this.sentToEmail.set(email);
    this.emailSent.set(true);

    // El AuthService ya muestra la notificación de éxito
    // Solo cambiar el estado visual del componente
    console.log('✅ Forgot password exitoso para:', email);
  }

  /**
   * Manejar errores
   */
  private handleError(error: any): void {
    // El AuthService ya maneja las notificaciones de error
    // Solo loggear para debugging si es necesario
    console.error('Error en forgot password component:', error);

    // Opcional: manejar errores específicos que no maneja el servicio
    if (error?.status === 422) {
      this.notificationService.warning(
        'Los datos enviados no son válidos. Revisa el formato del email.',
        'Datos Inválidos'
      );
    }
  }

}
