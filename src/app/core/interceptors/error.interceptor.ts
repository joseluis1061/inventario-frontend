import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Interceptor para manejo global de errores
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('🔥 Error HTTP interceptado:', error);

      // Logging detallado en desarrollo
      if (!environment.production) {
        console.group('📊 Detalles del Error HTTP');
        console.log('URL:', req.url);
        console.log('Método:', req.method);
        console.log('Status:', error.status);
        console.log('Mensaje:', error.message);
        console.log('Body:', error.error);
        console.groupEnd();
      }

      // Determinar si mostrar notificación (evitar duplicados con auth interceptor)
      const shouldShowNotification = !isAuthError(error) && !isSkippedUrl(req.url);

      if (shouldShowNotification) {
        handleErrorNotification(error, notificationService);
      }

      // Agregar mensaje personalizado al error
      const enhancedError = {
        ...error,
        userMessage: getUserMessage(error)
      };

      return throwError(() => enhancedError);
    })
  );
};

/**
 * Determinar mensaje de error para el usuario
 */
function getUserMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 0:
      return 'Error de conexión. Verifica tu conexión a internet.';
    case 400:
      return 'Datos inválidos enviados al servidor';
    case 401:
      return 'Sesión expirada o credenciales inválidas';
    case 403:
      return 'No tienes permisos para realizar esta acción';
    case 404:
      return 'Recurso no encontrado';
    case 408:
      return 'Tiempo de espera agotado. Intenta nuevamente.';
    case 409:
      return 'Conflicto con el estado actual del recurso';
    case 422:
      return 'Los datos enviados no pudieron ser procesados';
    case 429:
      return 'Demasiadas peticiones. Espera un momento.';
    case 500:
      return 'Error interno del servidor';
    case 502:
      return 'Servidor no disponible temporalmente';
    case 503:
      return 'Servicio no disponible temporalmente';
    case 504:
      return 'Tiempo de espera del servidor agotado';
    default:
      return 'Ha ocurrido un error inesperado';
  }
}

/**
 * Manejar notificaciones de error
 */
function handleErrorNotification(error: HttpErrorResponse, notificationService: NotificationService): void {
  const userMessage = getUserMessage(error);

  switch (error.status) {
    case 0:
      notificationService.networkError();
      break;

    case 400:
      notificationService.warning(userMessage, 'Datos Inválidos');
      break;

    case 404:
      notificationService.warning(userMessage, 'No Encontrado');
      break;

    case 408:
    case 504:
      notificationService.warning(userMessage, 'Tiempo Agotado');
      break;

    case 409:
      notificationService.warning(userMessage, 'Conflicto');
      break;

    case 422:
      notificationService.warning(userMessage, 'Datos No Procesables');
      break;

    case 429:
      notificationService.warning(userMessage, 'Límite Excedido');
      break;

    case 500:
    case 502:
    case 503:
      notificationService.error(userMessage, 'Error del Servidor');
      break;

    default:
      // Para errores no específicos, solo mostrar en desarrollo
      if (!environment.production) {
        notificationService.error(userMessage, `Error ${error.status}`);
      }
      break;
  }
}

/**
 * Verificar si es un error de autenticación (manejado por auth interceptor)
 */
function isAuthError(error: HttpErrorResponse): boolean {
  return error.status === 401 || error.status === 403;
}

/**
 * Verificar si es una URL que debe ser ignorada para notificaciones
 */
function isSkippedUrl(url: string): boolean {
  const skipUrls = [
    '/api/auth/refresh',
    '/api/health',
    '/api/auth/login' // Ya maneja sus propias notificaciones
  ];

  return skipUrls.some(skipUrl => url.includes(skipUrl));
}
