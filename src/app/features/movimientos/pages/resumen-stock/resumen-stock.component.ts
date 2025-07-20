import { Component, inject, signal, OnInit, OnDestroy, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';

// Chart.js imports
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

// jsPDF imports
import jsPDF from 'jspdf';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { MovimientoResumenProducto } from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-resumen-stock',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './resumen-stock.component.html',
  styleUrl: './resumen-stock.component.scss'
})
export class ResumenStockComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  // Referencias a las gráficas
  @ViewChild('chartEstadosStock', { static: false }) chartEstadosStock?: BaseChartDirective;
  @ViewChild('chartDistribucionStock', { static: false }) chartDistribucionStock?: BaseChartDirective;

  // ===== SIGNALS PARA ESTADO DEL COMPONENTE =====
  productos = signal<ProductoResponse[]>([]);
  resumenesProductos = signal<MovimientoResumenProducto[]>([]);
  productosSeleccionados = signal<number[]>([]);
  isLoadingProductos = signal(true);
  isLoadingResumenes = signal(false);
  error = signal<string | null>(null);
  viewMode = signal<'cards' | 'table'>('cards');
  sortField = signal<string>('nombreProducto');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canViewAllData = computed(() => this.authService.isManagerOrAbove());
  canExportData = computed(() => this.authService.isManagerOrAbove());

  // Formulario de filtros
  filtrosForm!: FormGroup;

  // ===== ESTADÍSTICAS CALCULADAS =====

  // Productos por estado de stock
  productosNormales = computed(() =>
    this.resumenesProductos().filter(p => p.estadoStock === 'NORMAL').length
  );

  productosBajos = computed(() =>
    this.resumenesProductos().filter(p => p.estadoStock === 'BAJO').length
  );

  productosCriticos = computed(() =>
    this.resumenesProductos().filter(p => p.estadoStock === 'CRITICO').length
  );

  // Total de productos
  totalProductos = computed(() => this.resumenesProductos().length);

  // Porcentajes
  porcentajeNormales = computed(() =>
    this.totalProductos() > 0 ? Math.round((this.productosNormales() / this.totalProductos()) * 100) : 0
  );

  porcentajeBajos = computed(() =>
    this.totalProductos() > 0 ? Math.round((this.productosBajos() / this.totalProductos()) * 100) : 0
  );

  porcentajeCriticos = computed(() =>
    this.totalProductos() > 0 ? Math.round((this.productosCriticos() / this.totalProductos()) * 100) : 0
  );

  // Estadísticas de inventario
  valorTotalInventario = computed(() =>
    this.resumenesProductos().reduce((total, p) => total + (p.stockActual * this.getProductoPrecio(p.productoId)), 0)
  );

  unidadesTotalesStock = computed(() =>
    this.resumenesProductos().reduce((total, p) => total + p.stockActual, 0)
  );

  productosInconsistentes = computed(() =>
    this.resumenesProductos().filter(p => !p.stockConsistente).length
  );

  // Resúmenes filtrados
  resumenesProductosFiltrados = computed(() => {
    let resumenes = [...this.resumenesProductos()];
    const filtros = this.filtrosForm?.value;

    console.log('Aplicando filtros:', filtros);
    console.log('Resúmenes antes de filtrar:', resumenes.length);

    if (!filtros) return resumenes;

    // Filtro por búsqueda
    if (filtros.busqueda && filtros.busqueda.trim() !== '') {
      const termino = filtros.busqueda.toLowerCase().trim();
      resumenes = resumenes.filter(p =>
        p.nombreProducto.toLowerCase().includes(termino)
      );
      console.log(`Después de filtro búsqueda "${termino}":`, resumenes.length);
    }

    // Filtro por estado de stock
    if (filtros.estadoStock && filtros.estadoStock !== 'TODOS') {
      resumenes = resumenes.filter(p => p.estadoStock === filtros.estadoStock);
      console.log(`Después de filtro estado "${filtros.estadoStock}":`, resumenes.length);
    }

    // Filtro por consistencia
    if (filtros.soloInconsistentes === true) {
      resumenes = resumenes.filter(p => !p.stockConsistente);
      console.log('Después de filtro inconsistentes:', resumenes.length);
    }

    // Ordenamiento
    const field = this.sortField();
    const direction = this.sortDirection();

    resumenes.sort((a, b) => {
      let valueA: any = a[field as keyof MovimientoResumenProducto];
      let valueB: any = b[field as keyof MovimientoResumenProducto];

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    console.log('Resúmenes después de todos los filtros:', resumenes.length);
    return resumenes;
  });

  // ===== CONFIGURACIONES DE GRÁFICAS =====

  // Gráfica de estados de stock
  chartEstadosStockData: ChartConfiguration['data'] = {
    labels: ['Normal', 'Bajo', 'Crítico'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderColor: ['#ffffff'],
      borderWidth: 2
    }]
  };

  chartEstadosStockOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Distribución por Estados de Stock',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  };

  // Gráfica de distribución de unidades
  chartDistribucionStockData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{
      label: 'Unidades en Stock',
      data: [],
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      borderWidth: 1
    }]
  };

  chartDistribucionStockOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Distribución de Stock por Productos',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // ===== MÉTODOS DE INICIALIZACIÓN =====

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formularios
   */
  private initializeForms(): void {
    this.filtrosForm = this.fb.group({
      busqueda: [''],
      estadoStock: ['TODOS'],
      soloInconsistentes: [false],
      cargarTodos: [false]
    });
  }

  /**
   * Cargar datos iniciales
   */
  private loadInitialData(): void {
    this.isLoadingProductos.set(true);

    this.productosService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar productos:', error);
          this.error.set('Error al cargar los productos. Por favor, intenta de nuevo.');
          return of([]);
        })
      )
      .subscribe(productos => {
        this.productos.set(productos);
        this.isLoadingProductos.set(false);

        // Cargar resúmenes de productos críticos y bajos inicialmente
        this.loadResumenesIniciales();
      });
  }

  /**
   * Configurar suscripciones a cambios en formularios
   */

  private setupFormSubscriptions(): void {
    // Cambios en filtros
    this.filtrosForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
      )
      .subscribe(filtros => {
        console.log('Filtros cambiados:', filtros);

        // Si se selecciona cargar todos, cargar todos los resúmenes
        if (filtros.cargarTodos && this.resumenesProductos().length < this.productos().length) {
          console.log('Cargando todos los resúmenes...');
          this.loadTodosLosResumenes();
        }

        // Actualizar gráficas con los datos filtrados
        this.updateChartsWithFilteredData();
      });

    // Suscripción específica para "cargar todos"
    this.filtrosForm.get('cargarTodos')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(cargarTodos => {
        if (cargarTodos && this.resumenesProductos().length < this.productos().length) {
          this.loadTodosLosResumenes();
        }
      });
  }

  /**
   * Actualizar gráficas con datos filtrados
   */
  private updateChartsWithFilteredData(): void {
    const datosFiltrados = this.resumenesProductosFiltrados();

    // Recalcular estadísticas con datos filtrados
    const normalesFiltrados = datosFiltrados.filter(p => p.estadoStock === 'NORMAL').length;
    const bajosFiltrados = datosFiltrados.filter(p => p.estadoStock === 'BAJO').length;
    const criticosFiltrados = datosFiltrados.filter(p => p.estadoStock === 'CRITICO').length;

    // Actualizar gráfica de estados con datos filtrados
    this.chartEstadosStockData.datasets[0].data = [normalesFiltrados, bajosFiltrados, criticosFiltrados];

    if (normalesFiltrados === 0 && bajosFiltrados === 0 && criticosFiltrados === 0) {
      this.chartEstadosStockData.datasets[0].data = [1, 1, 1];
      this.chartEstadosStockData.labels = ['Sin datos', 'Sin datos', 'Sin datos'];
    } else {
      this.chartEstadosStockData.labels = ['Normal', 'Bajo', 'Crítico'];
    }

    // Actualizar gráfica de distribución con datos filtrados
    const topProductosFiltrados = datosFiltrados
      .sort((a, b) => b.stockActual - a.stockActual)
      .slice(0, 10);

    if (topProductosFiltrados.length > 0) {
      this.chartDistribucionStockData.labels = topProductosFiltrados.map(p =>
        p.nombreProducto.length > 15 ? p.nombreProducto.substring(0, 15) + '...' : p.nombreProducto
      );
      this.chartDistribucionStockData.datasets[0].data = topProductosFiltrados.map(p => p.stockActual);
    } else {
      this.chartDistribucionStockData.labels = ['Sin datos'];
      this.chartDistribucionStockData.datasets[0].data = [1];
    }

    // Forzar actualización
    setTimeout(() => {
      this.chartEstadosStock?.chart?.update('active');
      this.chartDistribucionStock?.chart?.update('active');
    }, 100);
  }

  // ===== MÉTODOS PARA CARGAR DATOS =====

  /**
   * Cargar resúmenes iniciales (solo productos críticos y bajos)
   */
  private loadResumenesIniciales(): void {
    const productosPrioritarios = this.productos().filter(p =>
      p.estadoStock === 'CRÍTICO' || p.estadoStock === 'BAJO'
    );

    console.log('Productos prioritarios encontrados:', productosPrioritarios.length);
    console.log('Estados de productos:', this.productos().map(p => ({ id: p.id, nombre: p.nombre, estado: p.estadoStock })));

    if (productosPrioritarios.length === 0) {
      // Si no hay productos prioritarios, cargar los primeros 10
      console.log('No hay productos prioritarios, cargando primeros 10');
      this.loadResumenesLimitados(10);
      return;
    }

    this.loadResumenesParaProductos(productosPrioritarios.map(p => p.id));
  }

  /**
   * Cargar resúmenes limitados
   */
  private loadResumenesLimitados(limite: number): void {
    const productosIds = this.productos().slice(0, limite).map(p => p.id);
    this.loadResumenesParaProductos(productosIds);
  }

  /**
   * Cargar todos los resúmenes de productos
   */
  private loadTodosLosResumenes(): void {
    if (this.isLoadingResumenes()) {
      console.log('Ya se están cargando resúmenes, saltando...');
      return;
    }

    const todosLosIds = this.productos().map(p => p.id);
    console.log('Cargando todos los resúmenes para', todosLosIds.length, 'productos');
    this.loadResumenesParaProductos(todosLosIds);
  }

  /**
   * Cargar resúmenes para productos específicos
   */
  private loadResumenesParaProductos(productosIds: number[]): void {
    if (productosIds.length === 0) return;

    this.isLoadingResumenes.set(true);

    // Crear observables para cada producto
    const resumenObservables = productosIds.map(id =>
      this.movimientosService.obtenerResumenProducto(id).pipe(
        catchError(error => {
          console.warn(`Error al obtener resumen del producto ${id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(resumenObservables)
      .pipe(takeUntil(this.destroy$))
      .subscribe(resumenes => {
        // Filtrar nulos y actualizar
        const resumenesValidos = resumenes.filter(r => r !== null) as MovimientoResumenProducto[];
        console.log('Resúmenes cargados:', resumenesValidos.length);
        console.log('Estados en resúmenes:', resumenesValidos.map(r => ({ producto: r.nombreProducto, estado: r.estadoStock })));

        this.resumenesProductos.set(resumenesValidos);
        this.isLoadingResumenes.set(false);

        // Actualizar gráficas con delay
        setTimeout(() => {
          this.updateCharts();
        }, 200);
      });
  }

  /**
   * Actualizar gráficas
   */
  private updateCharts(): void {
    // Actualizar gráfica de estados
    const normales = this.productosNormales();
    const bajos = this.productosBajos();
    const criticos = this.productosCriticos();

    this.chartEstadosStockData.datasets[0].data = [normales, bajos, criticos];

    // Si todos los valores son 0, mostrar un valor mínimo para que se vea la gráfica
    if (normales === 0 && bajos === 0 && criticos === 0) {
      this.chartEstadosStockData.datasets[0].data = [1, 1, 1];
      this.chartEstadosStockData.labels = ['Sin datos', 'Sin datos', 'Sin datos'];
    } else {
      this.chartEstadosStockData.labels = ['Normal', 'Bajo', 'Crítico'];
    }

    // Actualizar gráfica de distribución (top 10 productos)
    const topProductos = this.resumenesProductosFiltrados()
      .sort((a, b) => b.stockActual - a.stockActual)
      .slice(0, 10);

    if (topProductos.length > 0) {
      this.chartDistribucionStockData.labels = topProductos.map(p =>
        p.nombreProducto.length > 15 ? p.nombreProducto.substring(0, 15) + '...' : p.nombreProducto
      );
      this.chartDistribucionStockData.datasets[0].data = topProductos.map(p => p.stockActual);
    } else {
      this.chartDistribucionStockData.labels = ['Sin datos'];
      this.chartDistribucionStockData.datasets[0].data = [1];
    }

    // Debug para verificar datos
    console.log('Datos gráfica estados:', this.chartEstadosStockData.datasets[0].data);
    console.log('Datos gráfica distribución:', this.chartDistribucionStockData.datasets[0].data);

    // Forzar actualización
    setTimeout(() => {
      if (this.chartEstadosStock?.chart) {
        this.chartEstadosStock.chart.data = this.chartEstadosStockData;
        this.chartEstadosStock.chart.update('active');
        console.log('Gráfica de estados actualizada');
      }

      if (this.chartDistribucionStock?.chart) {
        this.chartDistribucionStock.chart.data = this.chartDistribucionStockData;
        this.chartDistribucionStock.chart.update('active');
        console.log('Gráfica de distribución actualizada');
      }
    }, 100);
  }

  /**
   * Verificar si hay datos para mostrar en las gráficas
   */
  private hasDatosParaGraficas(): boolean {
    const resumenes = this.resumenesProductos();
    return resumenes.length > 0;
  }

  /**
   * Obtener mensaje cuando no hay datos
   */
  private getMensajeSinDatos(): string {
    if (this.isLoadingResumenes()) {
      return 'Cargando datos...';
    }
    if (this.resumenesProductos().length === 0) {
      return 'No hay productos cargados';
    }
    return 'Sin datos disponibles';
  }

  // ===== MÉTODOS PÚBLICOS PARA TEMPLATE =====

  /**
   * Obtener precio de un producto por ID
   */
  getProductoPrecio(productoId: number): number {
    const producto = this.productos().find(p => p.id === productoId);
    return producto?.precio || 0;
  }

  /**
   * Cambiar modo de vista
   */
  cambiarViewMode(modo: 'cards' | 'table'): void {
    this.viewMode.set(modo);
  }

  /**
   * Cambiar ordenamiento
   */
  cambiarOrden(campo: string): void {
    console.log('Cambiando orden por:', campo);

    if (this.sortField() === campo) {
      const newDirection = this.sortDirection() === 'asc' ? 'desc' : 'asc';
      this.sortDirection.set(newDirection);
      console.log('Nueva dirección:', newDirection);
    } else {
      this.sortField.set(campo);
      this.sortDirection.set('asc');
      console.log('Nuevo campo:', campo, 'dirección: asc');
    }

    // Triggerar actualización de computed
    setTimeout(() => {
      console.log('Productos después de reordenar:', this.resumenesProductosFiltrados().length);
    }, 100);
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltros(): void {
    this.filtrosForm.patchValue({
      busqueda: '',
      estadoStock: 'TODOS',
      soloInconsistentes: false
    });
    console.log('Filtros limpiados');
  }

  /**
   * Seleccionar/deseleccionar producto
   */
  toggleProductoSeleccionado(productoId: number): void {
    const seleccionados = this.productosSeleccionados();
    if (seleccionados.includes(productoId)) {
      this.productosSeleccionados.set(seleccionados.filter(id => id !== productoId));
    } else {
      this.productosSeleccionados.set([...seleccionados, productoId]);
    }
  }

  /**
   * Seleccionar todos los productos filtrados
   */
  seleccionarTodos(): void {
    const ids = this.resumenesProductosFiltrados().map(p => p.productoId);
    this.productosSeleccionados.set(ids);
  }

  /**
   * Deseleccionar todos los productos
   */
  deseleccionarTodos(): void {
    this.productosSeleccionados.set([]);
  }

  /**
   * Navegar a detalle de producto
   */
  verDetalleProducto(productoId: number): void {
    this.router.navigate(['/productos', productoId]);
  }

  /**
   * Navegar a movimientos del producto
   */
  verMovimientosProducto(productoId: number): void {
    this.router.navigate(['/movimientos/por-producto'], {
      queryParams: { producto: productoId }
    });
  }

  /**
   * Crear movimiento para el producto
   */
  crearMovimientoProducto(productoId: number, tipo: 'ENTRADA' | 'SALIDA'): void {
    this.router.navigate(['/movimientos/crear'], {
      queryParams: { producto: productoId, tipo: tipo }
    });
  }

  /**
   * Recargar datos
   */
  recargarDatos(): void {
    this.loadInitialData();
  }

  /**
   * Exportar resumen a PDF
   */
  exportarResumen(): void {
    const resumenes = this.resumenesProductosFiltrados();
    if (resumenes.length === 0) return;

    try {
      const doc = new jsPDF();
      const currentDate = new Date().toLocaleDateString('es-ES');

      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Stock de Productos', 20, 25);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado el: ${currentDate}`, 20, 35);

      // Estadísticas generales
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Estadísticas Generales', 20, 55);

      let yPos = 70;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const estadisticasGenerales = [
        ['Total de Productos:', this.totalProductos().toString()],
        ['Productos Normales:', `${this.productosNormales()} (${this.porcentajeNormales()}%)`],
        ['Productos con Stock Bajo:', `${this.productosBajos()} (${this.porcentajeBajos()}%)`],
        ['Productos Críticos:', `${this.productosCriticos()} (${this.porcentajeCriticos()}%)`],
        ['Productos Inconsistentes:', this.productosInconsistentes().toString()],
        ['Valor Total Inventario:', this.formatNumber(this.valorTotalInventario())],
        ['Unidades Totales:', this.formatNumber(this.unidadesTotalesStock())]
      ];

      estadisticasGenerales.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });

      // Detalle por productos (solo primeros 15)
      yPos += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle de Productos', 20, yPos);

      yPos += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      resumenes.slice(0, 15).forEach(resumen => {
        if (yPos > 250) { // Nueva página si es necesario
          doc.addPage();
          yPos = 20;
        }

        doc.text(`• ${resumen.nombreProducto}`, 20, yPos);
        doc.text(`Stock: ${resumen.stockActual}`, 120, yPos);
        doc.text(`Estado: ${resumen.estadoStock}`, 160, yPos);
        yPos += 6;
      });

      if (resumenes.length > 15) {
        yPos += 10;
        doc.text(`... y ${resumenes.length - 15} productos más`, 20, yPos);
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Sistema de Gestión de Inventario', 20, pageHeight - 20);
      doc.text(`Usuario: ${this.currentUser()?.nombreCompleto || 'Sistema'}`, 20, pageHeight - 15);

      const fileName = `resumen_stock_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      setTimeout(() => {
        this.notificationService?.success('Resumen de stock exportado exitosamente', 'Exportación Completada');
      }, 0);

    } catch (error) {
      console.error('Error al exportar resumen:', error);
      setTimeout(() => {
        this.notificationService?.error('Error al generar el reporte PDF', 'Error de Exportación');
      }, 0);
    }
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Obtener clase CSS para estado de stock
   */
  getEstadoStockClass(estado: 'NORMAL' | 'BAJO' | 'CRITICO'): string {
    switch (estado) {
      case 'NORMAL': return 'bg-green-100 text-green-800 border-green-200';
      case 'BAJO': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CRITICO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Obtener icono para estado de stock
   */
  getEstadoStockIcon(estado: 'NORMAL' | 'BAJO' | 'CRITICO'): string {
    switch (estado) {
      case 'NORMAL': return '✓';
      case 'BAJO': return '⚠';
      case 'CRITICO': return '⚠';
      default: return '?';
    }
  }

  /**
   * Formatear números con separadores de miles
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  /**
   * Formatear precio
   */
  formatPrice(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  /**
   * Obtener valor del inventario de un producto
   */
  getValorInventarioProducto(resumen: MovimientoResumenProducto): number {
    return resumen.stockActual * this.getProductoPrecio(resumen.productoId);
  }

  /**
   * Verificar si un producto está seleccionado
   */
  isProductoSeleccionado(productoId: number): boolean {
    return this.productosSeleccionados().includes(productoId);
  }

  /**
   * Obtener clase de flecha para ordenamiento
   */
  getSortArrowClass(campo: string): string {
    if (this.sortField() !== campo) return '';
    return this.sortDirection() === 'asc' ? 'rotate-0' : 'rotate-180';
  }
}
