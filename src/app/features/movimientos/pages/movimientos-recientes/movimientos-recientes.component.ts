import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, timer, switchMap, debounceTime, distinctUntilChanged } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import {
  MovimientoResponse,
  MovimientosRecientesParams,
  TipoMovimiento
} from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-movimientos-recientes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './movimientos-recientes.component.html',
  styleUrl: './movimientos-recientes.component.scss'
})
export class MovimientosRecientesComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  movimientosRecientes = signal<MovimientoResponse[]>([]);
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  loadingProductos = signal(true);
  loadingUsuarios = signal(true);
  diasSeleccionados = signal<number>(7);
  autoRefresh = signal<boolean>(true);
  showFilters = signal<boolean>(false);
  viewMode = signal<'cards' | 'list'>('cards');

  // Formulario de filtros rápidos
  filtrosForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canCreateMovimientos = computed(() => this.authService.isManagerOrAbove());

  // Estadísticas calculadas de los movimientos recientes
  totalMovimientos = computed(() => this.movimientosRecientes().length);
  totalEntradas = computed(() =>
    this.movimientosRecientes().filter(m => m.tipoMovimiento === 'ENTRADA').length
  );
  totalSalidas = computed(() =>
    this.movimientosRecientes().filter(m => m.tipoMovimiento === 'SALIDA').length
  );
  valorTotalMovimientos = computed(() =>
    this.movimientosRecientes().reduce((total, m) => total + m.valorMovimiento, 0)
  );

  // Movimientos filtrados
  movimientosFiltrados = computed(() => {
    const movimientos = this.movimientosRecientes();
    const filtros = this.filtrosForm?.value;

    if (!filtros) return movimientos;

    return movimientos.filter(movimiento => {
      // Filtro por búsqueda
      if (filtros.busqueda) {
        const termino = filtros.busqueda.toLowerCase();
        if (!movimiento.producto.nombre.toLowerCase().includes(termino) &&
            !movimiento.motivo.toLowerCase().includes(termino) &&
            !movimiento.usuario.nombreCompleto.toLowerCase().includes(termino)) {
          return false;
        }
      }

      // Filtro por tipo
      if (filtros.tipoMovimiento && movimiento.tipoMovimiento !== filtros.tipoMovimiento) {
        return false;
      }

      // Filtro por producto
      if (filtros.productoId && movimiento.producto.id !== Number(filtros.productoId)) {
        return false;
      }

      // Filtro por usuario
      if (filtros.usuarioId && movimiento.usuario.id !== Number(filtros.usuarioId)) {
        return false;
      }

      // Filtro por nivel de impacto
      if (filtros.nivelImpacto && movimiento.nivelImpacto !== filtros.nivelImpacto) {
        return false;
      }

      return true;
    });
  });

  // Opciones de días disponibles
  opcionesDias = [
    { value: 1, label: 'Hoy', description: 'Movimientos de hoy' },
    { value: 3, label: '3 días', description: 'Últimos 3 días' },
    { value: 7, label: '7 días', description: 'Última semana' },
    { value: 14, label: '14 días', description: 'Últimas 2 semanas' },
    { value: 30, label: '30 días', description: 'Último mes' }
  ];

  ngOnInit(): void {
    console.log('🚀 Inicializando MovimientosRecientesComponent');
    this.initializeFiltrosForm();
    this.cargarDatosIniciales();
    this.setupFormSubscriptions();
    this.processQueryParams();
    this.cargarMovimientosRecientes();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    console.log('🔄 Destruyendo MovimientosRecientesComponent');
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario de filtros
   */
  private initializeFiltrosForm(): void {
    this.filtrosForm = this.fb.group({
      busqueda: [''],
      tipoMovimiento: [''],
      productoId: [''],
      usuarioId: [''],
      nivelImpacto: ['']
    });
  }

  /**
   * Configurar suscripciones del formulario
   */
  private setupFormSubscriptions(): void {
    // Suscripción a cambios en los filtros con debounce
    this.filtrosForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        console.log('🔍 Filtros aplicados a movimientos recientes');
      });
  }

  /**
   * Procesar parámetros de consulta
   */
  private processQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['dias']) {
          this.diasSeleccionados.set(+params['dias']);
        }
        if (params['producto']) {
          this.filtrosForm.patchValue({ productoId: +params['producto'] });
        }
        if (params['usuario']) {
          this.filtrosForm.patchValue({ usuarioId: +params['usuario'] });
        }
        if (params['tipo']) {
          this.filtrosForm.patchValue({ tipoMovimiento: params['tipo'] });
        }
        if (params['view']) {
          this.viewMode.set(params['view'] as 'cards' | 'list');
        }
        if (params['autoRefresh'] === 'false') {
          this.autoRefresh.set(false);
        }
      });
  }

  /**
   * Cargar datos iniciales
   */
  private cargarDatosIniciales(): void {
    this.cargarProductos();
    this.cargarUsuarios();
  }

  /**
   * Cargar productos para filtros
   */
  private cargarProductos(): void {
    this.loadingProductos.set(true);

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
        this.loadingProductos.set(false);
        console.log(`📦 ${productos.length} productos cargados para filtros`);
      });
  }

  /**
   * Cargar usuarios para filtros
   */
  private cargarUsuarios(): void {
    this.loadingUsuarios.set(true);

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
        this.loadingUsuarios.set(false);
        console.log(`👥 ${usuarios.length} usuarios cargados para filtros`);
      });
  }

  /**
   * Cargar movimientos recientes
   */
  cargarMovimientosRecientes(): void {
    const params: MovimientosRecientesParams = {
      dias: this.diasSeleccionados()
    };

    this.movimientosService.obtenerRecientes(params)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar movimientos recientes:', error);
          return of([]);
        })
      )
      .subscribe(movimientos => {
        this.movimientosRecientes.set(movimientos);
        console.log(`🕒 ${movimientos.length} movimientos recientes cargados (${this.diasSeleccionados()} días)`);
      });
  }

  /**
   * Configurar auto-refresh
   */
  private setupAutoRefresh(): void {
    // Auto-refresh cada 30 segundos si está habilitado
    timer(0, 30000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          if (this.autoRefresh()) {
            return this.movimientosService.obtenerRecientes({ dias: this.diasSeleccionados() });
          }
          return of([]);
        }),
        catchError(error => {
          console.error('Error en auto-refresh:', error);
          return of([]);
        })
      )
      .subscribe(movimientos => {
        if (movimientos.length > 0 && this.autoRefresh()) {
          this.movimientosRecientes.set(movimientos);
          console.log('🔄 Movimientos actualizados automáticamente');
        }
      });
  }

  /**
   * Cambiar período de días
   */
  cambiarPeriodo(dias: number): void {
    if (this.diasSeleccionados() !== dias) {
      this.diasSeleccionados.set(dias);
      this.cargarMovimientosRecientes();

      // Actualizar URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { dias },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Alternar modo de vista
   */
  toggleViewMode(): void {
    const newMode = this.viewMode() === 'cards' ? 'list' : 'cards';
    this.viewMode.set(newMode);

    // Actualizar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: newMode },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Alternar auto-refresh
   */
  toggleAutoRefresh(): void {
    const newValue = !this.autoRefresh();
    this.autoRefresh.set(newValue);

    // Actualizar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { autoRefresh: newValue },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Alternar visibilidad de filtros
   */
  toggleFiltros(): void {
    this.showFilters.set(!this.showFilters());
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.filtrosForm.reset();
  }

  /**
   * Refrescar datos manualmente
   */
  refrescar(): void {
    this.cargarMovimientosRecientes();
  }

  /**
   * Navegación
   */
  volverAMovimientos(): void {
    this.router.navigate(['/movimientos']);
  }

  verHistorial(): void {
    this.router.navigate(['/movimientos/historial']);
  }

  verDetalle(movimientoId: number): void {
    this.router.navigate(['/movimientos', movimientoId]);
  }

  crearMovimiento(): void {
    this.router.navigate(['/movimientos/crear']);
  }

  verEstadisticas(): void {
    this.router.navigate(['/movimientos/estadisticas']);
  }

  verMovimientosProducto(productoId: number): void {
    this.router.navigate(['/movimientos/por-producto'], {
      queryParams: { producto: productoId }
    });
  }

  verMovimientosUsuario(usuarioId: number): void {
    this.router.navigate(['/movimientos'], {
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
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  }

  /**
   * Obtener clase CSS para el nivel de impacto
   */
  getNivelImpactoClass(nivel: string): string {
    switch (nivel.toLowerCase()) {
      case 'alto': return 'bg-red-100 text-red-800 border-red-200';
      case 'medio': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'bajo': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
   * Formatear fecha relativa (más detallada para recientes)
   */
  formatearFechaRelativa(fecha: string): string {
    const ahora = new Date();
    const fechaMovimiento = new Date(fecha);
    const diferencia = ahora.getTime() - fechaMovimiento.getTime();

    const segundos = Math.floor(diferencia / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (segundos < 60) return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;

    return this.formatearFecha(fecha);
  }

  /**
   * Obtener icono para el tipo de movimiento
   */
  getTipoMovimientoIcon(tipo: TipoMovimiento): string {
    return tipo === 'ENTRADA' ? 'M12 4l-8 8h16l-8-8z M12 4v16' : 'M12 20l8-8H4l8 8z M12 20V4';
  }

  /**
   * Verificar si hay filtros activos
   */
  hayFiltrosActivos(): boolean {
    const valores = this.filtrosForm?.value;
    if (!valores) return false;

    return !!(valores.busqueda || valores.tipoMovimiento ||
              valores.productoId || valores.usuarioId || valores.nivelImpacto);
  }

  /**
   * Obtener color del badge de período
   */
  getColorPeriodo(dias: number): string {
    switch (dias) {
      case 1: return 'bg-blue-500';
      case 3: return 'bg-green-500';
      case 7: return 'bg-purple-500';
      case 14: return 'bg-orange-500';
      case 30: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  /**
   * Obtener movimientos más recientes (top 5)
   */
  getMovimientosTop(): MovimientoResponse[] {
    return this.movimientosFiltrados().slice(0, 5);
  }

  /**
   * Obtener productos más activos en el período
   */
  getProductosMasActivos(): Array<{producto: string, cantidad: number, valor: number}> {
    const productosMap = new Map();

    this.movimientosRecientes().forEach(mov => {
      const key = mov.producto.nombre;
      if (productosMap.has(key)) {
        const existing = productosMap.get(key);
        productosMap.set(key, {
          producto: key,
          cantidad: existing.cantidad + 1,
          valor: existing.valor + mov.valorMovimiento
        });
      } else {
        productosMap.set(key, {
          producto: key,
          cantidad: 1,
          valor: mov.valorMovimiento
        });
      }
    });

    return Array.from(productosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }

  /**
   * Obtener iniciales del usuario
   */
  getInitialsUsuario(nombreCompleto: string): string {
    return nombreCompleto
      .split(' ')
      .map(nombre => nombre[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  /**
   * Obtener usuarios más activos en el período
   */
  getUsuariosMasActivos(): Array<{usuario: string, cantidad: number, valor: number}> {
    const usuariosMap = new Map();

    this.movimientosRecientes().forEach(mov => {
      const key = mov.usuario.nombreCompleto;
      if (usuariosMap.has(key)) {
        const existing = usuariosMap.get(key);
        usuariosMap.set(key, {
          usuario: key,
          cantidad: existing.cantidad + 1,
          valor: existing.valor + mov.valorMovimiento
        });
      } else {
        usuariosMap.set(key, {
          usuario: key,
          cantidad: 1,
          valor: mov.valorMovimiento
        });
      }
    });

    return Array.from(usuariosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }
}
