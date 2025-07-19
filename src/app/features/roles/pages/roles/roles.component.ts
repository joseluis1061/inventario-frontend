import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { RolesService } from '../../../../core/services/roles.service';
import { RolResponse } from '../../../../core/models/rol.interface';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit, OnDestroy {
  private readonly rolesService = inject(RolesService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  roles = signal<RolResponse[]>([]);
  searchTerm = signal<string>('');
  showDeleteConfirm = signal<number | null>(null);
  selectedTipoRol = signal<string | null>(null); // 'sistema' | 'personalizado' | null
  sortField = signal<string>('nombre');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Estados reactivos del servicio
  loadingStates = this.rolesService.loadingStates;

  ngOnInit(): void {
    this.cargarRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todos los roles
   */
  cargarRoles(): void {
    this.rolesService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar roles:', error);
          return of([]);
        })
      )
      .subscribe(roles => {
        this.roles.set(roles);
      });
  }

  /**
   * Filtrar y ordenar roles
   */
  get rolesFiltrados(): RolResponse[] {
    let roles = this.roles();

    // Filtrar por término de búsqueda
    const search = this.searchTerm().toLowerCase();
    if (search) {
      roles = roles.filter(rol =>
        rol.nombre.toLowerCase().includes(search) ||
        rol.descripcion.toLowerCase().includes(search) ||
        rol.estadoTexto.toLowerCase().includes(search)
      );
    }

    // Filtrar por tipo de rol
    const tipoRol = this.selectedTipoRol();
    if (tipoRol === 'sistema') {
      roles = roles.filter(rol => rol.esRolSistema);
    } else if (tipoRol === 'personalizado') {
      roles = roles.filter(rol => !rol.esRolSistema);
    }

    // Ordenar
    const field = this.sortField();
    const direction = this.sortDirection();

    roles.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'nombre':
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case 'descripcion':
          aValue = a.descripcion.toLowerCase();
          bValue = b.descripcion.toLowerCase();
          break;
        case 'fechaCreacion':
          aValue = new Date(a.fechaCreacion);
          bValue = new Date(b.fechaCreacion);
          break;
        case 'tipo':
          aValue = a.esRolSistema ? 'sistema' : 'personalizado';
          bValue = b.esRolSistema ? 'sistema' : 'personalizado';
          break;
        default:
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return roles;
  }

  /**
   * Estadísticas calculadas
   */
  get totalRoles(): number {
    return this.roles().length;
  }

  get rolesSistema(): number {
    return this.roles().filter(rol => rol.esRolSistema).length;
  }

  get rolesPersonalizados(): number {
    return this.roles().filter(rol => !rol.esRolSistema).length;
  }

  get rolesDisponibles(): number {
    return this.roles().filter(rol => rol.estadoTexto === 'Disponible').length;
  }

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  /**
   * Filtrar por tipo de rol
   */
  filtrarPorTipo(tipo: string | null): void {
    this.selectedTipoRol.set(tipo);
  }

  /**
   * Ordenar tabla
   */
  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  /**
   * Navegación a crear rol
   */
  crearRol(): void {
    this.router.navigate(['/roles/crear']);
  }

  /**
   * Navegación a editar rol
   */
  editarRol(id: number): void {
    this.router.navigate(['/roles/actualizar', id]);
  }

  /**
   * Ver detalles del rol
   */
  verRol(id: number): void {
    // Implementar modal o navegación a vista de detalles
    console.log('Ver rol:', id);
  }

  /**
   * Confirmar eliminación
   */
  confirmarEliminar(id: number): void {
    this.showDeleteConfirm.set(id);
  }

  /**
   * Cancelar eliminación
   */
  cancelarEliminar(): void {
    this.showDeleteConfirm.set(null);
  }

  /**
   * Eliminar rol
   */
  eliminarRol(id: number): void {
    const rol = this.roles().find(r => r.id === id);

    // Verificar si es un rol del sistema (no se puede eliminar)
    if (rol?.esRolSistema) {
      console.warn('No se puede eliminar un rol del sistema');
      return;
    }

    this.rolesService.eliminar(id)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al eliminar rol:', error);
          return of(null);
        })
      )
      .subscribe(() => {
        this.cargarRoles(); // Recargar la lista
        this.showDeleteConfirm.set(null);
      });
  }

  /**
   * Verificar si un rol se puede eliminar
   */
  puedeEliminar(rol: RolResponse): boolean {
    return !rol.esRolSistema;
  }

  /**
   * Verificar si un rol se puede editar
   */
  puedeEditar(rol: RolResponse): boolean {
    return !rol.esRolSistema;
  }

  /**
   * Obtener clase CSS para el tipo de rol
   */
  getTipoRolClass(rol: RolResponse): string {
    return rol.esRolSistema
      ? 'px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full'
      : 'px-3 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full';
  }

  /**
   * Obtener texto del tipo de rol
   */
  getTipoRolTexto(rol: RolResponse): string {
    return rol.esRolSistema ? 'Sistema' : 'Personalizado';
  }

  /**
   * Obtener clase CSS para el estado
   */
  getEstadoClass(rol: RolResponse): string {
    switch (rol.estadoTexto.toLowerCase()) {
      case 'rol del sistema':
        return 'px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full';
      case 'disponible':
        return 'px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full';
      default:
        return 'px-3 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full';
    }
  }

  /**
   * Formatear fecha
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Obtener icono según el nombre del rol
   */
  getRolIcono(nombre: string): string {
    switch (nombre.toUpperCase()) {
      case 'ADMIN':
        return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
      case 'GERENTE':
        return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
      case 'EMPLEADO':
        return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      case 'SUPERVISOR':
        return 'M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';
      default:
        return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
    }
  }

  /**
   * Track by function para optimizar la tabla
   */
  trackByRol(index: number, rol: RolResponse): number {
    return rol.id;
  }

  /**
   * Recargar datos
   */
  recargar(): void {
    this.cargarRoles();
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedTipoRol.set(null);
    this.sortField.set('nombre');
    this.sortDirection.set('asc');
  }

  /**
   * Obtener indicador de ordenamiento
   */
  getSortIndicator(field: string): string {
    if (this.sortField() !== field) return '';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }
}
