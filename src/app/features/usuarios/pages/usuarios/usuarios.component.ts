import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { UsuariosService } from '../../../../core/services/usuarios.service';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';
import { AuthService } from '../../../../core/services/auth-service.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit, OnDestroy {
  private readonly usuariosService = inject(UsuariosService);
  authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  usuarios = signal<UsuarioResponse[]>([]);
  searchTerm = signal<string>('');
  showDeleteConfirm = signal<number | null>(null);
  selectedRol = signal<number | null>(null);
  selectedEstado = signal<boolean | null>(null);
  sortField = signal<string>('nombreCompleto');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Estados reactivos del servicio
  loadingStates = this.usuariosService.loadingStates;

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todos los usuarios
   */
  cargarUsuarios(): void {
    this.usuariosService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar usuarios:', error);
          return of([]);
        })
      )
      .subscribe(usuarios => {
        this.usuarios.set(usuarios);
      });
  }

  /**
   * Filtrar y ordenar usuarios
   */
  get usuariosFiltrados(): UsuarioResponse[] {
    let usuarios = this.usuarios();

    // Filtrar por término de búsqueda
    const search = this.searchTerm().toLowerCase();
    if (search) {
      usuarios = usuarios.filter(usuario =>
        usuario.username.toLowerCase().includes(search) ||
        usuario.nombreCompleto.toLowerCase().includes(search) ||
        usuario.email.toLowerCase().includes(search) ||
        usuario.nombreRol.toLowerCase().includes(search)
      );
    }

    // Filtrar por rol
    if (this.selectedRol()) {
      usuarios = usuarios.filter(usuario =>
        usuario.rol.id === this.selectedRol()
      );
    }

    // Filtrar por estado
    if (this.selectedEstado() !== null) {
      usuarios = usuarios.filter(usuario =>
        usuario.activo === this.selectedEstado()
      );
    }

    // Ordenar
    const field = this.sortField();
    const direction = this.sortDirection();

    usuarios.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'username':
          valueA = a.username.toLowerCase();
          valueB = b.username.toLowerCase();
          break;
        case 'nombreCompleto':
          valueA = a.nombreCompleto.toLowerCase();
          valueB = b.nombreCompleto.toLowerCase();
          break;
        case 'email':
          valueA = a.email.toLowerCase();
          valueB = b.email.toLowerCase();
          break;
        case 'rol':
          valueA = a.nombreRol.toLowerCase();
          valueB = b.nombreRol.toLowerCase();
          break;
        case 'fechaCreacion':
          valueA = new Date(a.fechaCreacion);
          valueB = new Date(b.fechaCreacion);
          break;
        case 'estado':
          valueA = a.activo ? 1 : 0;
          valueB = b.activo ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return usuarios;
  }

  /**
   * Obtener roles únicos para el filtro
   */
  get rolesUnicos(): Array<{id: number, nombre: string}> {
    const usuarios = this.usuarios();
    const rolesMap = new Map();

    usuarios.forEach(usuario => {
      if (!rolesMap.has(usuario.rol.id)) {
        rolesMap.set(usuario.rol.id, {
          id: usuario.rol.id,
          nombre: usuario.rol.nombre
        });
      }
    });

    return Array.from(rolesMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  /**
   * Cambiar filtro de rol
   */
  onRolFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.selectedRol.set(value ? Number(value) : null);
  }

  /**
   * Cambiar filtro de estado
   */
  onEstadoFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    if (value === '') {
      this.selectedEstado.set(null);
    } else {
      this.selectedEstado.set(value === 'true');
    }
  }

  /**
   * Cambiar ordenamiento
   */
  onSort(field: string): void {
    if (this.sortField() === field) {
      // Cambiar dirección si es el mismo campo
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo, ordenar ascendente
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedRol.set(null);
    this.selectedEstado.set(null);
  }

  /**
   * Limpiar búsqueda
   */
  limpiarBusqueda(): void {
    this.searchTerm.set('');
  }

  /**
   * Refrescar lista de usuarios
   */
  refrescar(): void {
    this.usuariosService.refrescar()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al refrescar usuarios:', error);
          return of([]);
        })
      )
      .subscribe(usuarios => {
        this.usuarios.set(usuarios);
      });
  }

  /**
   * Navegar a crear nuevo usuario
   */
  crearUsuario(): void {
    this.router.navigate(['/usuarios/crear']);
  }

  /**
   * Editar usuario
   */
  editarUsuario(usuario: UsuarioResponse): void {
    this.router.navigate(['/usuarios/actualizar', usuario.id]);
  }

  /**
   * Cambiar estado del usuario (activar/desactivar)
   */
  cambiarEstado(usuario: UsuarioResponse): void {
    const nuevoEstado = !usuario.activo;

    this.usuariosService.cambiarEstado(usuario.id, nuevoEstado)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cambiar estado del usuario:', error);
          return of(null);
        })
      )
      .subscribe(usuarioActualizado => {
        if (usuarioActualizado) {
          // Actualizar lista local
          const usuariosActuales = this.usuarios();
          const index = usuariosActuales.findIndex(u => u.id === usuario.id);
          if (index !== -1) {
            usuariosActuales[index] = usuarioActualizado;
            this.usuarios.set([...usuariosActuales]);
          }
        }
      });
  }

  /**
   * Mostrar confirmación de eliminación
   */
  confirmarEliminar(usuarioId: number): void {
    this.showDeleteConfirm.set(usuarioId);
  }

  /**
   * Cancelar eliminación
   */
  cancelarEliminar(): void {
    this.showDeleteConfirm.set(null);
  }

  /**
   * Eliminar usuario
   */
  eliminarUsuario(usuarioId: number): void {
    this.usuariosService.eliminar(usuarioId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al eliminar usuario:', error);
          return of(null);
        })
      )
      .subscribe(() => {
        // Actualizar lista local removiendo el usuario eliminado
        const usuariosActuales = this.usuarios();
        this.usuarios.set(usuariosActuales.filter(user => user.id !== usuarioId));
        this.showDeleteConfirm.set(null);
      });
  }

  /**
   * Obtener usuario a eliminar por ID
   */
  getUsuarioToDelete(): UsuarioResponse | undefined {
    const id = this.showDeleteConfirm();
    return id ? this.usuarios().find(u => u.id === id) : undefined;
  }

  /**
   * TrackBy function para optimizar renderizado
   */
  trackByUsuario(index: number, usuario: UsuarioResponse): number {
    return usuario.id;
  }

  /**
   * Obtener clase CSS para el estado del usuario
   */
  getEstadoClass(activo: boolean): string {
    return activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  /**
   * Obtener clase CSS para el rol
   */
  getRolClass(rol: string): string {
    switch (rol) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800';
      case 'GERENTE': return 'bg-blue-100 text-blue-800';
      case 'EMPLEADO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  }

  /**
   * Verificar si el usuario actual puede realizar acciones sobre otro usuario
   */
  puedeEditar(usuario: UsuarioResponse): boolean {
    // No puede editar admin principal
    if (usuario.esAdminPrincipal) {
      return false;
    }

    // Solo admin puede editar otros usuarios
    return this.authService.isAdmin();
  }

  /**
   * Verificar si puede eliminar un usuario
   */
  puedeEliminar(usuario: UsuarioResponse): boolean {
    // No puede eliminar admin principal
    if (usuario.esAdminPrincipal) {
      return false;
    }

    // No puede eliminarse a sí mismo
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id === usuario.id) {
      return false;
    }

    // Solo admin puede eliminar y usuario debe ser eliminable
    return this.authService.isAdmin() && usuario.eliminable;
  }

  /**
   * Verificar si puede cambiar estado
   */
  puedeCambiarEstado(usuario: UsuarioResponse): boolean {
    // No puede cambiar estado del admin principal
    if (usuario.esAdminPrincipal) {
      return false;
    }

    // No puede cambiar su propio estado
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id === usuario.id) {
      return false;
    }

    // Solo admin puede cambiar estados
    return this.authService.isAdmin();
  }

  // Getters para estadísticas
  get totalUsuarios(): number {
    return this.usuarios().length;
  }

  get usuariosActivos(): number {
    return this.usuarios().filter(u => u.activo).length;
  }

  get usuariosInactivos(): number {
    return this.usuarios().filter(u => !u.activo).length;
  }

  get usuariosAdmins(): number {
    return this.usuarios().filter(u => u.nombreRol === 'ADMIN').length;
  }

  /**
   * Formatear fecha de creación
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Obtener icono de ordenamiento
   */
  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  /**
   * Verificar si es el usuario actual
   */
  esUsuarioActual(usuario: UsuarioResponse): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser ? currentUser.id === usuario.id : false;
  }
}
