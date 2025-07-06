import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment.development';

/**
 * Interceptor para manejo global de errores
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
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

      // Personalizar mensajes de error
      let userMessage = 'Ha ocurrido un error inesperado';

      switch (error.status) {
        case 0:
          userMessage = 'Error de conexión. Verifica tu conexión a internet.';
          break;
        case 400:
          userMessage = 'Datos inválidos enviados al servidor';
          break;
        case 401:
          userMessage = 'Sesión expirada o credenciales inválidas';
          break;
        case 403:
          userMessage = 'No tienes permisos para realizar esta acción';
          break;
        case 404:
          userMessage = 'Recurso no encontrado';
          break;
        case 500:
          userMessage = 'Error interno del servidor';
          break;
        case 503:
          userMessage = 'Servicio no disponible temporalmente';
          break;
      }

      // Agregar mensaje personalizado al error
      const enhancedError = {
        ...error,
        userMessage
      };

      return throwError(() => enhancedError);
    })
  );
};
