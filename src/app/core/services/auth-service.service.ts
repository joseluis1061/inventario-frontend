import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { LoginRequest, LoginResponse, UserInfo } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private readonly http = inject(HttpClient);

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
            this.handleLoginSuccess(response);
          }
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
  }

  private handleLogout(): void {
    // Limpiar storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');

    // Actualizar estado
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private checkStoredAuth(): void {
    const token = this.getAccessToken();
    const userInfo = localStorage.getItem('userInfo');

    if (token && userInfo) {
      try {
        const user: UserInfo = JSON.parse(userInfo);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      } catch (error) {
        console.error('Error parsing stored user info:', error);
        this.handleLogout();
      }
    }
  }
}
