import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import {
  MovimientoResponse,
  MovimientoResumenProducto,
  TipoMovimiento
} from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-movimientos-por-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './movimientos-por-producto.component.html',
  styleUrl: './movimientos-por-producto.component.scss'
})
export class MovimientosPorProductoComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  movimientosProducto = signal<MovimientoResponse[]>([]);
  resumenProducto = signal<MovimientoResumenProducto | null>(null);
  productoSeleccionado = signal<ProductoResponse | null>(null);
  loadingProductos = signal(true);
  loadingUsuarios = signal(true);
  showFilters = signal<boolean>(false);
  viewMode = signal<'timeline' | 'table'>('timeline');

  // Formulario de filtros
  filtrosForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canCreateMovimientos = computed(() => this.authService.isManagerOrAbove());

  // Movimientos filtrados y ordenados
  movimientosFiltrados = computed(() => {
    const movimientos = this.movimientosProducto();
    const filtros = this.filtrosForm?.value;

    if (!filtros) return movimientos;

    return movimientos.filter(movimiento => {
      // Filtro por búsqueda en motivo
      if (filtros.busqueda) {
        const termino = filtros.busqueda.toLowerCase();
        if (!movimiento.motivo.toLowerCase().includes(termino) &&
            !movimiento.usuario.nombreCompleto.toLowerCase().includes(termino)) {
          return false;
        }
      }

      // Filtro por tipo
      if (filtros.tipoMovimiento && movimiento.tipoMovimiento !== filtros.tipoMovimiento) {
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

      // Filtro por rango de fechas
      if (filtros.fechaInicio || filtros.fechaFin) {
        const fechaMovimiento = new Date(movimiento.fecha);

        if (filtros.fechaInicio) {
          const fechaInicio = new Date(filtros.fechaInicio);
          if (fechaMovimiento < fechaInicio) return false;
        }

        if (filtros.fechaFin) {
          const fechaFin = new Date(filtros.fechaFin);
          if (fechaMovimiento > fechaFin) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Ordenar por fecha descendente (más recientes primero)
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  });

  // Estadísticas calculadas
  totalMovimientos = computed(() => this.movimientosFiltrados().length);
  totalEntradas = computed(() =>
    this.movimientosFiltrados().filter(m => m.tipoMovimiento === 'ENTRADA').length
  );
  totalSalidas = computed(() =>
    this.movimientosFiltrados().filter(m => m.tipoMovimiento === 'SALIDA').length
  );
  valorTotalMovimientos = computed(() =>
    this.movimientosFiltrados().reduce((total, m) => total + m.valorMovimiento, 0)
  );
  unidadesTotalesEntradas = computed(() =>
    this.movimientosFiltrados()
      .filter(m => m.tipoMovimiento === 'ENTRADA')
      .reduce((total, m) => total + m.cantidad, 0)
  );
  unidadesTotalesSalidas = computed(() =>
    this.movimientosFiltrados()
      .filter(m => m.tipoMovimiento === 'SALIDA')
      .reduce((total, m) => total + m.cantidad, 0)
  );

  // Agrupación de movimientos por fecha para timeline
  movimientosAgrupadosPorFecha = computed(() => {
    const movimientos = this.movimientosFiltrados();
    const grupos = new Map<string, MovimientoResponse[]>();

    movimientos.forEach(movimiento => {
      const fecha = new Date(movimiento.fecha).toLocaleDateString('es-CO');
      if (!grupos.has(fecha)) {
        grupos.set(fecha, []);
      }
      grupos.get(fecha)!.push(movimiento);
    });

    return Array.from(grupos.entries()).map(([fecha, movimientos]) => ({
      fecha,
      movimientos: movimientos.sort((a, b) =>
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      )
    }));
  });

  ngOnInit(): void {
    console.log('🚀 Inicializando MovimientosPorProductoComponent');
    this.initializeFiltrosForm();
    this.cargarDatosIniciales();
    this.setupFormSubscriptions();
    this.processQueryParams();
  }

  ngOnDestroy(): void {
    console.log('🔄 Destruyendo MovimientosPorProductoComponent');
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario de filtros
   */
  private initializeFiltrosForm(): void {
    this.filtrosForm = this.fb.group({
      productoId: [''],
      busqueda: [''],
      tipoMovimiento: [''],
      usuarioId: [''],
      nivelImpacto: [''],
      fechaInicio: [''],
      fechaFin: ['']
    });
  }

  /**
   * Configurar suscripciones del formulario
   */
  private setupFormSubscriptions(): void {
    // Suscripción al cambio de producto
    this.filtrosForm.get('productoId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(),
        switchMap(productoId => {
          if (productoId) {
            return this.cargarMovimientosDelProducto(+productoId);
          }
          return of([]);
        })
      )
      .subscribe(movimientos => {
        this.movimientosProducto.set(movimientos);
      });

    // Suscripción a otros filtros con debounce
    this.filtrosForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        console.log('🔍 Filtros aplicados a movimientos por producto');
      });
  }

  /**
   * Procesar parámetros de consulta
   */
  private processQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['producto']) {
          this.filtrosForm.patchValue({ productoId: +params['producto'] }, { emitEvent: true });
        }
        if (params['usuario']) {
          this.filtrosForm.patchValue({ usuarioId: +params['usuario'] });
        }
        if (params['tipo']) {
          this.filtrosForm.patchValue({ tipoMovimiento: params['tipo'] });
        }
        if (params['view']) {
          this.viewMode.set(params['view'] as 'timeline' | 'table');
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
   * Cargar productos para selector
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
        console.log(`📦 ${productos.length} productos cargados`);
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
        console.log(`👥 ${usuarios.length} usuarios cargados`);
      });
  }

  /**
   * Cargar movimientos del producto seleccionado
   */
  private cargarMovimientosDelProducto(productoId: number): Promise<MovimientoResponse[]> {
    return new Promise((resolve) => {
      // Cargar producto seleccionado
      const producto = this.productos().find(p => p.id === productoId);
      this.productoSeleccionado.set(producto || null);

      // Cargar movimientos
      this.movimientosService.obtenerPorProducto(productoId)
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            console.error('Error al cargar movimientos del producto:', error);
            return of([]);
          })
        )
        .subscribe(movimientos => {
          console.log(`📦 ${movimientos.length} movimientos cargados para producto ${productoId}`);
          resolve(movimientos);
        });

      // Cargar resumen del producto
      this.cargarResumenProducto(productoId);
    });
  }

  /**
   * Cargar resumen estadístico del producto
   */
  private cargarResumenProducto(productoId: number): void {
    this.movimientosService.obtenerResumenProducto(productoId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar resumen del producto:', error);
          return of(null);
        })
      )
      .subscribe(resumen => {
        this.resumenProducto.set(resumen);
        console.log('📊 Resumen del producto cargado:', resumen);
      });
  }

  /**
   * Cambiar producto seleccionado
   */
  cambiarProducto(productoId: number): void {
    this.filtrosForm.patchValue({ productoId }, { emitEvent: true });

    // Actualizar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { producto: productoId },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Alternar modo de vista
   */
  toggleViewMode(): void {
    const newMode = this.viewMode() === 'timeline' ? 'table' : 'timeline';
    this.viewMode.set(newMode);

    // Actualizar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: newMode },
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
   * Limpiar filtros (excepto producto)
   */
  limpiarFiltros(): void {
    const productoId = this.filtrosForm.get('productoId')?.value;
    this.filtrosForm.reset({ productoId });
  }

  /**
   * Navegación
   */
  volverAMovimientos(): void {
    this.router.navigate(['/movimientos']);
  }

  verDetalle(movimientoId: number): void {
    this.router.navigate(['/movimientos', movimientoId]);
  }

  verHistorial(): void {
    this.router.navigate(['/movimientos/historial']);
  }

  verRecientes(): void {
    this.router.navigate(['/movimientos/recientes']);
  }

  crearMovimiento(): void {
    const productoId = this.filtrosForm.get('productoId')?.value;
    if (productoId) {
      this.router.navigate(['/movimientos/crear'], {
        queryParams: { producto: productoId }
      });
    } else {
      this.router.navigate(['/movimientos/crear']);
    }
  }

  verDetalleProducto(): void {
    const productoId = this.filtrosForm.get('productoId')?.value;
    if (productoId) {
      this.router.navigate(['/productos', productoId]);
    }
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
   * TrackBy function para grupos de fecha
   */
  trackByFecha(index: number, grupo: any): string {
    return grupo.fecha;
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
   * Obtener clase CSS para el estado de stock
   */
  getEstadoStockClass(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'CRITICO': return 'text-red-600 bg-red-50';
      case 'BAJO': return 'text-yellow-600 bg-yellow-50';
      case 'NORMAL': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
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
   * Formatear fecha relativa
   */
  formatearFechaRelativa(fecha: string): string {
    const ahora = new Date();
    const fechaMovimiento = new Date(fecha);
    const diferencia = ahora.getTime() - fechaMovimiento.getTime();

    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor(diferencia / (1000 * 60));

    if (dias === 0) {
      if (horas === 0) {
        if (minutos < 1) return 'Hace un momento';
        return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
      }
      return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    }
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;

    return this.formatearFecha(fecha);
  }

  /**
   * Obtener icono para el tipo de movimiento
   */
  getTipoMovimientoIcon(tipo: TipoMovimiento): string {
    return tipo === 'ENTRADA'
      ? 'M12 4l-8 8h16l-8-8z M12 4v16'
      : 'M12 20l8-8H4l8 8z M12 20V4';
  }

  /**
   * Verificar si hay filtros activos (excepto producto)
   */
  hayFiltrosActivos(): boolean {
    const valores = this.filtrosForm?.value;
    if (!valores) return false;

    return !!(valores.busqueda || valores.tipoMovimiento ||
              valores.usuarioId || valores.nivelImpacto ||
              valores.fechaInicio || valores.fechaFin);
  }

  /**
   * Obtener color del timeline según el tipo
   */
  getTimelineColor(tipo: TipoMovimiento): string {
    return tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500';
  }

  /**
   * Obtener resumen del período de movimientos
   */
  getResumenPeriodo(): string {
    const movimientos = this.movimientosFiltrados();
    if (movimientos.length === 0) return 'Sin movimientos';

    const fechas = movimientos.map(m => new Date(m.fecha));
    const fechaMin = new Date(Math.min(...fechas.map(f => f.getTime())));
    const fechaMax = new Date(Math.max(...fechas.map(f => f.getTime())));

    const formatoFecha = (fecha: Date) => fecha.toLocaleDateString('es-CO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (fechaMin.toDateString() === fechaMax.toDateString()) {
      return `Movimientos del ${formatoFecha(fechaMin)}`;
    }

    return `Período: ${formatoFecha(fechaMin)} - ${formatoFecha(fechaMax)}`;
  }

  /**
   * Verificar si hay resumen disponible
   */
  hayResumenDisponible(): boolean {
    return this.resumenProducto() !== null;
  }

  /**
   * Obtener diferencia neta de unidades
   */
  getDiferenciaNeta(): number {
    return this.unidadesTotalesEntradas() - this.unidadesTotalesSalidas();
  }

  /**
   * Obtener clase para diferencia neta
   */
  getDiferenciaNetaClass(): string {
    const diferencia = this.getDiferenciaNeta();
    if (diferencia > 0) return 'text-green-600';
    if (diferencia < 0) return 'text-red-600';
    return 'text-neutral-600';
  }
}
