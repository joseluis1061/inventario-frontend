import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Interceptor funcional para manejo de autenticación JWT
 * Agrega token a requests y maneja errores de autenticación
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // URLs que no requieren token
  const publicUrls = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/health',
    '/api/public'
  ];

  // Verificar si es una URL pública
  const isPublicUrl = publicUrls.some(url => req.url.includes(url));

  if (isPublicUrl) {
    return next(req);
  }

  // Obtener token de acceso
  const accessToken = authService.getAccessToken();

  if (!accessToken) {
    // Si no hay token, redirigir a login
    router.navigate(['/login']);
    return throwError(() => new Error('No access token available'));
  }

  // Clonar request y agregar header de autorización
  const authReq = addTokenToRequest(req, accessToken);

  // Procesar request con manejo de errores
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      return handleHttpError(error, authService, router, req, next);
    })
  );
};

/**
 * Agregar token JWT al header Authorization
 */
function addTokenToRequest(req: HttpRequest<any>, token: string): HttpRequest<any> {
  return req.clone({
    setHeaders: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Manejar errores HTTP, especialmente 401 (Unauthorized)
 */
function handleHttpError(
  error: HttpErrorResponse,
  authService: AuthService,
  router: Router,
  originalReq: HttpRequest<any>,
  next: HttpHandlerFn
) {
  // Error 401 - Token expirado o inválido
  if (error.status === 401) {
    return handle401Error(authService, router, originalReq, next);
  }

  // Error 403 - Sin permisos
  if (error.status === 403) {
    console.warn('🚫 Acceso denegado - Sin permisos suficientes');
    router.navigate(['/dashboard']); // Redirigir a página segura
    return throwError(() => error);
  }

  // Otros errores
  return throwError(() => error);
}

/**
 * Manejar error 401 - Intentar refresh token o logout
 */
function handle401Error(
  authService: AuthService,
  router: Router,
  originalReq: HttpRequest<any>,
  next: HttpHandlerFn
) {
  const refreshToken = authService.getRefreshToken();

  if (!refreshToken) {
    // No hay refresh token, hacer logout
    console.warn('🔴 Token expirado sin refresh token disponible');
    authService.logout().subscribe();
    router.navigate(['/login']);
    return throwError(() => new Error('Token expired - no refresh available'));
  }

  // Intentar refrescar token
  console.log('🔄 Intentando refrescar token...');

  return authService.refreshToken().pipe(
    switchMap((response) => {
      console.log('✅ Token refrescado exitosamente');
      // Reintentar request original con nuevo token
      const newAuthReq = addTokenToRequest(originalReq, response.accessToken);
      return next(newAuthReq);
    }),
    catchError((refreshError) => {
      // Fallo al refrescar token, hacer logout
      console.error('❌ Error al refrescar token:', refreshError);
      authService.logout().subscribe();
      router.navigate(['/login']);
      return throwError(() => refreshError);
    })
  );
}
