import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service.ts.service';

/**
 * Interceptor para mostrar loading spinner automáticamente
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // URLs que no deben mostrar loading
  const skipLoadingUrls = [
    '/api/auth/refresh',
    '/api/health',
    '/api/auth/logout' // Logout debe ser rápido
  ];

  const shouldSkipLoading = skipLoadingUrls.some(url => req.url.includes(url));

  if (!shouldSkipLoading) {
    loadingService.show();
  }

  return next(req).pipe(
    finalize(() => {
      if (!shouldSkipLoading) {
        loadingService.hide();
      }
    })
  );
};
