import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import { MovimientoResponse, TipoMovimiento } from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-movimientos-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movimientos-list.component.html',
  styleUrl: './movimientos-list.component.scss'
})
export class MovimientosListComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  movimientos = signal<MovimientoResponse[]>([]);
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  searchTerm = signal<string>('');
  selectedTipo = signal<TipoMovimiento | null>(null);
  selectedProducto = signal<number | null>(null);
  selectedUsuario = signal<number | null>(null);
  sortField = signal<string>('fecha');
  sortDirection = signal<'asc' | 'desc'>('desc');
  showFilters = signal<boolean>(false);

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  ngOnInit(): void {
    this.cargarDatos();
    this.setupSearchSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar datos iniciales
   */
  cargarDatos(): void {
    // Cargar movimientos
    this.cargarMovimientos();

    // Cargar productos para filtros
    this.cargarProductos();

    // Cargar usuarios para filtros
    this.cargarUsuarios();
  }

  /**
   * Cargar todos los movimientos
   */
  cargarMovimientos(): void {
    this.movimientosService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar movimientos:', error);
          return of([]);
        })
      )
      .subscribe(movimientos => {
        this.movimientos.set(movimientos);
      });
  }

  /**
   * Cargar productos para filtros
   */
  cargarProductos(): void {
    this.productosService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar productos:', error);
          return of([]);
        })
      )
      .subscribe(productos => {
        this.productos.set(productos);
      });
  }

  /**
   * Cargar usuarios para filtros
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
   * Configurar suscripción de búsqueda con debounce
   */
  private setupSearchSubscription(): void {
    // Implementar búsqueda reactiva si es necesario
  }

  /**
   * Filtrar y ordenar movimientos
   */
  get movimientosFiltrados(): MovimientoResponse[] {
    let movimientos = this.movimientos();

    // Filtrar por término de búsqueda
    const search = this.searchTerm().toLowerCase();
    if (search) {
      movimientos = movimientos.filter(movimiento =>
        movimiento.producto.nombre.toLowerCase().includes(search) ||
        movimiento.motivo.toLowerCase().includes(search) ||
        movimiento.usuario.nombreCompleto.toLowerCase().includes(search) ||
        movimiento.usuario.username.toLowerCase().includes(search)
      );
    }

    // Filtrar por tipo
    if (this.selectedTipo()) {
      movimientos = movimientos.filter(m => m.tipoMovimiento === this.selectedTipo());
    }

    // Filtrar por producto
    if (this.selectedProducto()) {
      movimientos = movimientos.filter(m => m.producto.id === this.selectedProducto());
    }

    // Filtrar por usuario
    if (this.selectedUsuario()) {
      movimientos = movimientos.filter(m => m.usuario.id === this.selectedUsuario());
    }

    // Ordenar
    const field = this.sortField();
    const direction = this.sortDirection();

    movimientos.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (field) {
        case 'fecha':
          valueA = new Date(a.fecha);
          valueB = new Date(b.fecha);
          break;
        case 'producto':
          valueA = a.producto.nombre.toLowerCase();
          valueB = b.producto.nombre.toLowerCase();
          break;
        case 'tipo':
          valueA = a.tipoMovimiento;
          valueB = b.tipoMovimiento;
          break;
        case 'cantidad':
          valueA = a.cantidad;
          valueB = b.cantidad;
          break;
        case 'valor':
          valueA = a.valorMovimiento;
          valueB = b.valorMovimiento;
          break;
        case 'usuario':
          valueA = a.usuario.nombreCompleto.toLowerCase();
          valueB = b.usuario.nombreCompleto.toLowerCase();
          break;
        default:
          valueA = a[field as keyof MovimientoResponse];
          valueB = b[field as keyof MovimientoResponse];
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return movimientos;
  }

  /**
   * Manejar cambio de tipo de movimiento
   */
  onProductoChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.filtrarPorProducto(value ? +value : null);
  }

  onUsuarioChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.filtrarPorUsuario(value ? +value : null);
  }

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  /**
   * Manejar ordenamiento
   */
  onSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  /**
   * Filtrar por tipo
   */
  filtrarPorTipo(tipo: TipoMovimiento | null): void {
    this.selectedTipo.set(tipo);
  }

  /**
   * Filtrar por producto
   */
  filtrarPorProducto(productoId: number | null): void {
    this.selectedProducto.set(productoId);
  }

  /**
   * Filtrar por usuario
   */
  filtrarPorUsuario(usuarioId: number | null): void {
    this.selectedUsuario.set(usuarioId);
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedTipo.set(null);
    this.selectedProducto.set(null);
    this.selectedUsuario.set(null);
    this.sortField.set('fecha');
    this.sortDirection.set('desc');
  }

  /**
   * Alternar visibilidad de filtros
   */
  toggleFiltros(): void {
    this.showFilters.set(!this.showFilters());
  }

  /**
   * Navegación a crear movimiento
   */
  crearMovimiento(): void {
    this.router.navigate(['/movimientos/crear']);
  }

  /**
   * Navegación a detalle de movimiento
   */
  verDetalle(id: number): void {
    this.router.navigate(['/movimientos', id]);
  }

  /**
   * Navegación a análisis por producto
   */
  verPorProducto(): void {
    this.router.navigate(['/movimientos/por-producto']);
  }

  /**
   * Navegación a historial avanzado
   */
  verHistorial(): void {
    this.router.navigate(['/movimientos/historial']);
  }

  /**
   * Navegación a dashboard de recientes
   */
  verRecientes(): void {
    this.router.navigate(['/movimientos/recientes']);
  }

  /**
   * Navegación a estadísticas
   */
  verEstadisticas(): void {
    this.router.navigate(['/movimientos/estadisticas']);
  }

  /**
   * Ver movimientos de un producto específico
   */
  verMovimientosProducto(productoId: number): void {
    this.router.navigate(['/movimientos/por-producto'], {
      queryParams: { producto: productoId }
    });
  }

  /**
   * Ver movimientos de un usuario específico
   */
  verMovimientosUsuario(usuarioId: number): void {
    this.router.navigate(['/movimientos/por-usuario'], {
      queryParams: { usuario: usuarioId }
    });
  }

  /**
   * Obtener información del producto por ID
   */
  getProductoPorId(id: number): ProductoResponse | undefined {
    return this.productos().find(p => p.id === id);
  }

  /**
   * Obtener información del usuario por ID
   */
  getUsuarioPorId(id: number): UsuarioResponse | undefined {
    return this.usuarios().find(u => u.id === id);
  }

  /**
   * TrackBy function para optimizar renderizado
   */
  trackByMovimiento(index: number, movimiento: MovimientoResponse): number {
    return movimiento.id;
  }

  /**
   * Obtener clase CSS para el tipo de movimiento
   */
  getTipoMovimientoClass(tipo: TipoMovimiento): string {
    return tipo === 'ENTRADA'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  }

  /**
   * Obtener clase CSS para el nivel de impacto
   */
  getNivelImpactoClass(nivel: string): string {
    switch (nivel.toLowerCase()) {
      case 'alto': return 'bg-red-100 text-red-800';
      case 'medio': return 'bg-yellow-100 text-yellow-800';
      case 'bajo': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Verificar si el usuario actual puede crear movimientos
   */
  puedeCrear(): boolean {
    return this.authService.isManagerOrAbove();
  }

  /**
   * Verificar si el usuario actual puede ver detalles
   */
  puedeVerDetalle(): boolean {
    return this.authService.isAuthenticated();
  }

  // Getters para estadísticas
  get totalMovimientos(): number {
    return this.movimientos().length;
  }

  get totalEntradas(): number {
    return this.movimientos().filter(m => m.tipoMovimiento === 'ENTRADA').length;
  }

  get totalSalidas(): number {
    return this.movimientos().filter(m => m.tipoMovimiento === 'SALIDA').length;
  }

  get valorTotalMovimientos(): number {
    return this.movimientos().reduce((total, m) => total + m.valorMovimiento, 0);
  }

  get movimientosRecientes(): number {
    const hoy = new Date();
    const hace24h = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
    return this.movimientos().filter(m => new Date(m.fecha) >= hace24h).length;
  }

  /**
   * Formatear precio en pesos colombianos
   */
  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  }

  /**
   * Formatear fecha
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatear fecha relativa (hace X tiempo)
   */
  formatearFechaRelativa(fecha: string): string {
    const ahora = new Date();
    const fechaMovimiento = new Date(fecha);
    const diferencia = ahora.getTime() - fechaMovimiento.getTime();

    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    if (minutos < 1) return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;

    return this.formatearFecha(fecha);
  }

  /**
   * Obtener icono de ordenamiento
   */
  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  /**
   * Recargar datos
   */
  recargar(): void {
    this.cargarMovimientos();
  }

  /**
   * Obtener nombre del producto por ID
   */
  getNombreProducto(productoId: number): string {
    const producto = this.getProductoPorId(productoId);
    return producto ? producto.nombre : 'Producto no encontrado';
  }

  /**
   * Obtener nombre del usuario por ID
   */
  getNombreUsuario(usuarioId: number): string {
    const usuario = this.getUsuarioPorId(usuarioId);
    return usuario ? usuario.nombreCompleto : 'Usuario no encontrado';
  }
}
