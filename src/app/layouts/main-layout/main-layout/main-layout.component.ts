import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';

import { AuthService } from '../../../core/services/auth-service.service';
import { NotificationService } from '../../../core/services';
import { LoadingService } from '../../../core/services';

@Component({
  selector: 'app-main-layout',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Estado del componente
  sidebarOpen = signal(false);
  userMenuOpen = signal(false);
  currentRoute = signal('dashboard');
  isMobile = window.innerWidth < 1024;

  // Estados reactivos
  currentUser = this.authService.currentUser;
  isLoading$ = inject(LoadingService).loading$;

  ngOnInit(): void {
    this.setupRouteTracking();
    this.setupMobileDetection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar(): void {
    this.sidebarOpen.update(value => !value);
  }

  /**
   * Cerrar sidebar
   */
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /**
   * Toggle user menu
   */
  toggleUserMenu(): void {
    this.userMenuOpen.update(value => !value);
  }

  /**
   * Cerrar user menu
   */
  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  /**
   * Logout
   */
  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  /**
   * Obtener iniciales del usuario
   */
  getUserInitials(): string {
    const user = this.currentUser();
    if (!user?.nombreCompleto) return 'U';

    const names = user.nombreCompleto.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  /**
   * Verificar si es admin
   */
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /**
   * Verificar si es gerente o superior
   */
  isManagerOrAbove(): boolean {
    return this.authService.isManagerOrAbove();
  }

  /**
   * Obtener año actual
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Obtener título de la página actual
   */
  getCurrentPageTitle(): string {
    const route = this.currentRoute();
    const titles: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'productos': 'Productos',
      'categorias': 'Categorías',
      'movimientos': 'Movimientos',
      'reportes': 'Reportes',
      'usuarios': 'Usuarios',
      'roles': 'Roles',
      'configuracion': 'Configuración'
    };
    return titles[route] || 'Página';
  }

  /**
   * Configurar seguimiento de rutas
   */
  private setupRouteTracking(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        const route = event.url.split('/')[1] || 'dashboard';
        this.currentRoute.set(route);

        // Cerrar menús en mobile al navegar
        if (this.isMobile) {
          this.closeSidebar();
          this.closeUserMenu();
        }
      });
  }

  /**
   * Configurar detección de mobile
   */
  private setupMobileDetection(): void {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 1024;
      if (!this.isMobile) {
        this.sidebarOpen.set(false);
      }
    });
  }
}
