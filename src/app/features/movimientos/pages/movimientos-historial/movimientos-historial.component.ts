import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import {
  MovimientoResponse,
  MovimientoHistorialResponse,
  MovimientoHistorialParams,
  TipoMovimiento
} from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-movimientos-historial',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './movimientos-historial.component.html',
  styleUrl: './movimientos-historial.component.scss'
})
export class MovimientosHistorialComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();
  showExportMenu = signal<boolean>(false);

  // Signals para estado del componente
  historialData = signal<MovimientoHistorialResponse | null>(null);
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  loadingProductos = signal(true);
  loadingUsuarios = signal(true);
  showFilters = signal<boolean>(true);
  currentPage = signal<number>(0);
  pageSize = signal<number>(10);
  exportando = signal<boolean>(false);

  // Formulario de filtros
  filtrosForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canExport = computed(() => this.authService.isManagerOrAbove());

  // Información de paginación
  totalElements = computed(() => this.historialData()?.totalElements || 0);
  totalPages = computed(() => this.historialData()?.totalPages || 0);
  hasNextPage = computed(() => !this.historialData()?.last);
  hasPreviousPage = computed(() => !this.historialData()?.first);

  // Movimientos actuales
  movimientos = computed(() => this.historialData()?.content || []);

  // Opciones de tamaño de página
  pageSizeOptions = [5, 10, 25, 50, 100];

  // Rangos de fecha predefinidos
  rangosFecha = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Ayer', value: 'ayer' },
    { label: 'Últimos 7 días', value: '7dias' },
    { label: 'Últimos 30 días', value: '30dias' },
    { label: 'Este mes', value: 'estemes' },
    { label: 'Mes anterior', value: 'mesanterior' },
    { label: 'Últimos 3 meses', value: '3meses' },
    { label: 'Este año', value: 'esteano' },
    { label: 'Personalizado', value: 'personalizado' }
  ];

  /**
   * Cambiar tamaño de página
   */
  cambiarTamanoPagina(nuevoTamaño: number): void {
    this.pageSize.set(nuevoTamaño);
    this.currentPage.set(0);
    this.cargarHistorial();
  }

  ngOnInit(): void {
    this.initializeFiltrosForm();
    this.cargarDatosIniciales();
    this.setupFormSubscriptions();
    this.processQueryParams();
    this.cargarHistorial();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Alternar menú de exportación
   */
  toggleExportMenu(): void {
    this.showExportMenu.set(!this.showExportMenu());
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
      rangoFecha: ['7dias'],
      fechaInicio: [''],
      fechaFin: [''],
      montoMinimo: [''],
      montoMaximo: [''],
      nivelImpacto: [''],
      categoriaMotivo: ['']
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
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.currentPage.set(0); // Resetear a primera página
        this.cargarHistorial();
      });

    // Suscripción específica para el rango de fecha
    this.filtrosForm.get('rangoFecha')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(rango => {
        this.aplicarRangoFecha(rango);
      });
  }

  /**
   * Aplicar rango de fecha predefinido
   */
  private aplicarRangoFecha(rango: string): void {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    let fechaInicio: Date | null = null;
    let fechaFin: Date | null = null;

    switch (rango) {
      case 'hoy':
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
        break;
      case 'ayer':
        fechaInicio = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());
        fechaFin = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59);
        break;
      case '7dias':
        fechaInicio = new Date(hoy);
        fechaInicio.setDate(hoy.getDate() - 7);
        fechaFin = hoy;
        break;
      case '30dias':
        fechaInicio = new Date(hoy);
        fechaInicio.setDate(hoy.getDate() - 30);
        fechaFin = hoy;
        break;
      case 'estemes':
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaFin = hoy;
        break;
      case 'mesanterior':
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
        break;
      case '3meses':
        fechaInicio = new Date(hoy);
        fechaInicio.setMonth(hoy.getMonth() - 3);
        fechaFin = hoy;
        break;
      case 'esteano':
        fechaInicio = new Date(hoy.getFullYear(), 0, 1);
        fechaFin = hoy;
        break;
      case 'personalizado':
        // No aplicar fechas automáticas, el usuario las define
        return;
    }

    if (fechaInicio && fechaFin && rango !== 'personalizado') {
      this.filtrosForm.patchValue({
        fechaInicio: this.formatDateForInput(fechaInicio),
        fechaFin: this.formatDateForInput(fechaFin)
      }, { emitEvent: false });
    }
  }

  /**
   * Formatear fecha para input type="datetime-local"
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Procesar parámetros de consulta
   */
  private processQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['producto']) {
          this.filtrosForm.patchValue({ productoId: +params['producto'] });
        }
        if (params['usuario']) {
          this.filtrosForm.patchValue({ usuarioId: +params['usuario'] });
        }
        if (params['tipo']) {
          this.filtrosForm.patchValue({ tipoMovimiento: params['tipo'] });
        }
        if (params['page']) {
          this.currentPage.set(+params['page']);
        }
        if (params['size']) {
          this.pageSize.set(+params['size']);
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
      });
  }

  /**
   * Cargar historial con filtros y paginación
   */
  cargarHistorial(): void {
    const params: MovimientoHistorialParams = {
      pagina: this.currentPage(),
      tamaño: this.pageSize()
    };

    this.movimientosService.obtenerHistorial(params)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar historial:', error);
          return of(null);
        })
      )
      .subscribe(historial => {
        this.historialData.set(historial);
      });
  }

  /**
   * Cambiar página
   */
  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 0 && nuevaPagina < this.totalPages()) {
      this.currentPage.set(nuevaPagina);
      this.cargarHistorial();
      this.scrollToTop();
    }
  }

  /**
   * Cambiar tamaño de página
   */
  cambiarTamañoPagina(nuevoTamaño: number): void {
    this.pageSize.set(nuevoTamaño);
    this.currentPage.set(0);
    this.cargarHistorial();
  }

  /**
   * Ir a primera página
   */
  irAPrimeraPagina(): void {
    this.cambiarPagina(0);
  }

  /**
   * Ir a última página
   */
  irAUltimaPagina(): void {
    this.cambiarPagina(this.totalPages() - 1);
  }

  /**
   * Página anterior
   */
  paginaAnterior(): void {
    if (this.hasPreviousPage()) {
      this.cambiarPagina(this.currentPage() - 1);
    }
  }

  /**
   * Página siguiente
   */
  paginaSiguiente(): void {
    if (this.hasNextPage()) {
      this.cambiarPagina(this.currentPage() + 1);
    }
  }

  /**
   * Scroll hacia arriba
   */
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltros(): void {
    this.filtrosForm.reset({
      rangoFecha: '7dias'
    });
    this.currentPage.set(0);
  }

  /**
   * Alternar visibilidad de filtros
   */
  toggleFiltros(): void {
    this.showFilters.set(!this.showFilters());
  }

  /**
   * Exportar datos (simulado)
   */

  exportarDatos(formato: 'excel' | 'pdf' | 'csv'): void {
    if (!this.canExport()) return;

    this.exportando.set(true);

    // Obtener los datos actuales con filtros aplicados
    const params: MovimientoHistorialParams = {
      pagina: 0, // Exportar desde la primera página
      tamaño: this.totalElements() // Exportar todos los elementos
    };

    this.movimientosService.obtenerHistorial(params)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al obtener datos para exportar:', error);
          this.exportando.set(false);
          return of(null);
        })
      )
      .subscribe(historial => {
        if (historial && historial.content.length > 0) {
          switch (formato) {
            case 'excel':
              this.exportarExcel(historial.content);
              break;
            case 'pdf':
              this.exportarPDF(historial.content);
              break;
            case 'csv':
              this.exportarCSV(historial.content);
              break;
          }
        }
        this.exportando.set(false);
      });
  }

  /**
   * Exportar a Excel
   */
  private exportarExcel(movimientos: MovimientoResponse[]): void {
    // Implementar exportación a Excel usando una librería como xlsx
    console.log('Exportando a Excel:', movimientos);
    // TODO: Implementar con librería xlsx
  }

  /**
   * Exportar a PDF
   */
  private exportarPDF(movimientos: MovimientoResponse[]): void {
    // Implementar exportación a PDF usando una librería como jsPDF
    console.log('Exportando a PDF:', movimientos);
    // TODO: Implementar con librería jsPDF
  }

  /**
   * Exportar a CSV
   */
  private exportarCSV(movimientos: MovimientoResponse[]): void {
    const headers = [
      'ID',
      'Fecha',
      'Tipo',
      'Producto',
      'Cantidad',
      'Motivo',
      'Usuario',
      'Valor',
      'Impacto'
    ];

    const data = movimientos.map(mov => [
      mov.id,
      this.formatearFecha(mov.fecha),
      mov.tipoMovimiento,
      mov.producto.nombre,
      mov.cantidad,
      mov.motivo,
      mov.usuario.nombreCompleto,
      mov.valorMovimiento,
      mov.nivelImpacto
    ]);

    const csvContent = [headers, ...data]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `movimientos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  crearMovimiento(): void {
    this.router.navigate(['/movimientos/crear']);
  }

  verEstadisticas(): void {
    this.router.navigate(['/movimientos/estadisticas']);
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
   * Obtener información de paginación
   */
  getRangoElementos(): string {
    const inicio = this.currentPage() * this.pageSize() + 1;
    const fin = Math.min((this.currentPage() + 1) * this.pageSize(), this.totalElements());
    return `${inicio} - ${fin} de ${this.totalElements()}`;
  }

  /**
   * Obtener páginas visibles para paginador
   */
  getPaginasVisibles(): number[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const visible = 5; // Mostrar máximo 5 páginas

    let start = Math.max(0, current - Math.floor(visible / 2));
    let end = Math.min(total - 1, start + visible - 1);

    if (end - start < visible - 1) {
      start = Math.max(0, end - visible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  /**
   * Verificar si puede crear movimientos
   */
  puedeCrearMovimientos(): boolean {
    return this.authService.isManagerOrAbove();
  }

  /**
   * Obtener total de filtros activos
   */
  getFiltrosActivos(): number {
    const valores = this.filtrosForm.value;
    let activos = 0;

    if (valores.busqueda) activos++;
    if (valores.tipoMovimiento) activos++;
    if (valores.productoId) activos++;
    if (valores.usuarioId) activos++;
    if (valores.rangoFecha && valores.rangoFecha !== '7dias') activos++;
    if (valores.montoMinimo) activos++;
    if (valores.montoMaximo) activos++;
    if (valores.nivelImpacto) activos++;
    if (valores.categoriaMotivo) activos++;

    return activos;
  }

  /**
   * Manejar cambio de tamaño de página desde el select
   */
  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select?.value;
    if (value) {
      this.cambiarTamanoPagina(+value);
    }
  }

  /**
   * Recargar datos
   */
  recargar(): void {
    this.cargarHistorial();
  }
}
