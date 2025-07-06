import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { LoginRequest, LoginResponse, UserInfo } from '../models';
import { NotificationService } from '../../core/services/notification.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  // Estado de autenticación
  private currentUserSubject = new BehaviorSubject<UserInfo | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    // Verificar si hay token guardado al inicializar
    this.checkStoredAuth();
  }

  /**
   * Realizar login
   */
  login(loginData: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, loginData)
      .pipe(
        tap(response => {
          if (response.success) {
            this.handleLoginSuccess(response);
          }
        }),
        catchError(error => {
          this.handleLoginError(error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Cerrar sesión
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {})
      .pipe(
        tap(() => {
          this.handleLogout();
        }),
        catchError(error => {
          // Aunque falle el logout en el servidor, limpiar localmente
          this.handleLogout();
          this.notificationService.warning('Sesión cerrada localmente', 'Logout');
          return throwError(() => error);
        })
      );
  }

  /**
   * Refrescar token
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        tap(response => {
          if (response.success) {
            this.handleTokenRefresh(response);
          }
        }),
        catchError(error => {
          this.handleRefreshError(error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): UserInfo | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtener token de acceso
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * Obtener token de refresco
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  /**
   * Verificar si el usuario tiene permisos de administrador
   */
  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  /**
   * Verificar si el usuario es gerente o superior
   */
  isManagerOrAbove(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'ADMIN' || user?.role === 'GERENTE';
  }

  // ===== MÉTODOS PRIVADOS =====

  private handleLoginSuccess(response: LoginResponse): void {
    // Guardar tokens
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('userInfo', JSON.stringify(response.user));

    // Actualizar estado
    this.currentUserSubject.next(response.user);
    this.isAuthenticatedSubject.next(true);

    // Notificar éxito
    this.notificationService.loginSuccess(response.user.nombreCompleto);
  }

  private handleLoginError(error: any): void {
    console.error('❌ Error en login:', error);

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

    // Notificar error
    this.notificationService.loginError(errorMessage);
  }

  private handleLogout(): void {
    const user = this.getCurrentUser();

    // Limpiar storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');

    // Actualizar estado
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    // Notificar logout
    if (user) {
      this.notificationService.logoutSuccess();
    }
  }

  private handleTokenRefresh(response: LoginResponse): void {
    // Actualizar tokens
    localStorage.setItem('accessToken', response.accessToken);
    if (response.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
    }

    // Actualizar info de usuario si viene en la respuesta
    if (response.user) {
      localStorage.setItem('userInfo', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
    }

    console.log('🔄 Token refrescado exitosamente');
    // No mostrar notificación para refresh automático (sería molesto)
  }

  private handleRefreshError(error: any): void {
    console.error('❌ Error al refrescar token:', error);

    // Token refresh falló, hacer logout
    this.handleLogout();

    // Notificar sesión expirada
    this.notificationService.sessionExpired();
  }

  private checkStoredAuth(): void {
    const token = this.getAccessToken();
    const userInfo = localStorage.getItem('userInfo');

    if (token && userInfo) {
      try {
        const user: UserInfo = JSON.parse(userInfo);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);

        // Notificación silenciosa de sesión restaurada
        console.log(`🔐 Sesión restaurada para: ${user.nombreCompleto}`);
      } catch (error) {
        console.error('Error parsing stored user info:', error);
        this.handleLogout();
        this.notificationService.error('Error al restaurar sesión. Inicia sesión nuevamente.', 'Sesión Inválida');
      }
    }
  }
}
