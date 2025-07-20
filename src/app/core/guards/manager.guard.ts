import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth-service.service';

/**
 * Guard para rutas que requieren permisos de gerente o superior
 */
export const managerGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | Promise<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('📊 ManagerGuard: Verificando permisos de gerente para:', state.url);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.log('❌ ManagerGuard: Usuario no autenticado');
        router.navigate(['/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }

      if (authService.isManagerOrAbove()) {
        console.log('✅ ManagerGuard: Usuario tiene permisos de gerente o superior');
        return true;
      } else {
        console.log('❌ ManagerGuard: Usuario no tiene permisos de gerente');
        router.navigate(['/movimientos'], { //dashboard
          queryParams: {
            error: 'manager_required',
            message: 'Se requieren permisos de gerente o administrador'
          }
        });
        return false;
      }
    })
  );
};
