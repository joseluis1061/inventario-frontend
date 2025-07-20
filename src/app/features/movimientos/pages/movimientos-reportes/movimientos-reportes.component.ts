import { Component, inject, signal, OnInit, OnDestroy, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin, debounceTime, distinctUntilChanged, combineLatest, finalize } from 'rxjs';

// Chart.js imports
import { Chart, ChartConfiguration, ChartType, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

// jsPDF imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// XLSX import
import * as XLSX from 'xlsx';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { CategoriasService } from '../../../../core/services/categorias.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import { NotificationService } from '../../../../core/services/notification.service';

import {
  MovimientoResponse,
  MovimientoEstadisticas,
  MovimientoEstadisticasParams,
  MovimientoResumenProducto,
  TipoMovimiento,
  MovimientoFiltros
} from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';
import { CategoriaResponse } from '../../../../core/models/categoria.interface';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

// Interfaces específicas para reportes
interface ReporteConfig {
  incluirGraficas: boolean;
  incluirTablas: boolean;
  incluirEstadisticas: boolean;
  incluirResumen: boolean;
  formatoExportacion: 'PDF' | 'EXCEL' | 'AMBOS';
  tipoReporte: 'EJECUTIVO' | 'DETALLADO' | 'OPERATIVO';
}

interface ReporteMetricas {
  totalMovimientos: number;
  totalEntradas: number;
  totalSalidas: number;
  unidadesEntradas: number;
  unidadesSalidas: number;
  valorTotalMovido: number;
  diferenciaUnidades: number;
  porcentajeEntradas: number;
  porcentajeSalidas: number;
  promedioMovimientosPorDia: number;
  productosAfectados: number;
  usuariosActivos: number;
  categoriasMasActivas: string[];
  tendenciaMensual: 'CRECIENTE' | 'DECRECIENTE' | 'ESTABLE';
}

interface ReporteResumenProducto extends MovimientoResumenProducto {
  valorInventario: number;
  rotacionStock: number;
  diasSinMovimiento: number;
  criticidad: 'ALTA' | 'MEDIA' | 'BAJA';
}

@Component({
  selector: 'app-movimientos-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './movimientos-reportes.component.html',
  styleUrl: './movimientos-reportes.component.scss'
})
export class MovimientosReportesComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  // Referencias a las gráficas
  @ViewChild('chartResumenGeneral', { static: false }) chartResumenGeneral?: BaseChartDirective;
  @ViewChild('chartTendenciaTemporal', { static: false }) chartTendenciaTemporal?: BaseChartDirective;
  @ViewChild('chartDistribucionCategorias', { static: false }) chartDistribucionCategorias?: BaseChartDirective;
  @ViewChild('chartTopProductos', { static: false }) chartTopProductos?: BaseChartDirective;
  @ViewChild('chartRendimientoUsuarios', { static: false }) chartRendimientoUsuarios?: BaseChartDirective;
  @ViewChild('chartComparativoMensual', { static: false }) chartComparativoMensual?: BaseChartDirective;

  // ===== SIGNALS PARA ESTADO DEL COMPONENTE =====
  movimientos = signal<MovimientoResponse[]>([]);
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  categorias = signal<CategoriaResponse[]>([]);
  estadisticasGenerales = signal<MovimientoEstadisticas | null>(null);
  resumenProductos = signal<ReporteResumenProducto[]>([]);
  metricas = signal<ReporteMetricas | null>(null);

  isLoadingData = signal(true);
  isGeneratingReport = signal(false);
  isExporting = signal(false);
  error = signal<string | null>(null);

  reporteGenerado = signal(false);
  fechaUltimaGeneracion = signal<Date | null>(null);

  // Estados reactivos de los servicios
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  isAdmin = computed(() => this.authService.isAdmin());
  canGenerateReports = computed(() => this.authService.isManagerOrAbove());
  canExportReports = computed(() => this.authService.isManagerOrAbove());

  // Formularios
  filtrosForm!: FormGroup;
  configReporteForm!: FormGroup;

  // Configuraciones de gráficas
  chartColors = {
    primary: '#3b82f6',
    secondary: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#8b5cf6',
    light: '#f8fafc',
    dark: '#1e293b'
  };

  // ===== CONFIGURACIONES DE GRÁFICAS =====

  // Gráfica de resumen general (Doughnut)
  chartResumenGeneralData: ChartConfiguration['data'] = {
    labels: ['Entradas', 'Salidas'],
    datasets: [{
      label: 'Movimientos',
      data: [0, 0],
      backgroundColor: [this.chartColors.success, this.chartColors.danger],
      borderColor: [this.chartColors.success, this.chartColors.danger],
      borderWidth: 2,
      hoverBorderWidth: 3
    }]
  };

  chartResumenGeneralOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'Distribución de Movimientos',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  // Gráfica de tendencia temporal (Line)
  chartTendenciaTemporalData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Entradas',
        data: [],
        borderColor: this.chartColors.success,
        backgroundColor: `${this.chartColors.success}20`,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: this.chartColors.success,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5
      },
      {
        label: 'Salidas',
        data: [],
        borderColor: this.chartColors.danger,
        backgroundColor: `${this.chartColors.danger}20`,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: this.chartColors.danger,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5
      }
    ]
  };

  chartTendenciaTemporalOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Tendencia Temporal de Movimientos',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  // Gráfica de distribución por categorías (Bar)
  chartDistribucionCategoriasData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{
      label: 'Movimientos por Categoría',
      data: [],
      backgroundColor: [
        this.chartColors.primary,
        this.chartColors.secondary,
        this.chartColors.success,
        this.chartColors.warning,
        this.chartColors.info,
        this.chartColors.danger
      ],
      borderColor: [
        this.chartColors.primary,
        this.chartColors.secondary,
        this.chartColors.success,
        this.chartColors.warning,
        this.chartColors.info,
        this.chartColors.danger
      ],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false
    }]
  };

  chartDistribucionCategoriasOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Movimientos por Categoría',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  // Gráfica de top productos (Horizontal Bar)
  chartTopProductosData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{
      label: 'Cantidad de Movimientos',
      data: [],
      backgroundColor: this.chartColors.primary,
      borderColor: this.chartColors.primary,
      borderWidth: 2,
      borderRadius: 8
    }]
  };

  chartTopProductosOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Top 10 Productos con Más Movimientos',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  // Gráfica de rendimiento de usuarios (Radar)
  chartRendimientoUsuariosData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{
      label: 'Movimientos por Usuario',
      data: [],
      backgroundColor: `${this.chartColors.secondary}30`,
      borderColor: this.chartColors.secondary,
      borderWidth: 2,
      pointBackgroundColor: this.chartColors.secondary,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2
    }]
  };

  chartRendimientoUsuariosOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Actividad por Usuario',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  // Gráfica comparativo mensual (Mixed Chart)
  chartComparativoMensualData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        type: 'bar' as const,
        label: 'Unidades Entrada',
        data: [],
        backgroundColor: `${this.chartColors.success}80`,
        borderColor: this.chartColors.success,
        borderWidth: 2,
        yAxisID: 'y'
      },
      {
        type: 'bar' as const,
        label: 'Unidades Salida',
        data: [],
        backgroundColor: `${this.chartColors.danger}80`,
        borderColor: this.chartColors.danger,
        borderWidth: 2,
        yAxisID: 'y'
      },
      {
        type: 'line' as const,
        label: 'Diferencia Neta',
        data: [],
        borderColor: this.chartColors.primary,
        backgroundColor: this.chartColors.primary,
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: this.chartColors.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        yAxisID: 'y1'
      }
    ]
  };

  chartComparativoMensualOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Unidades'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Diferencia Neta'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Análisis Comparativo Mensual',
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== INICIALIZACIÓN =====

  /**
   * Inicializar formularios
   */
  private initializeForms(): void {
    // Formulario de filtros
    this.filtrosForm = this.fb.group({
      fechaInicio: [this.getDefaultStartDate(), Validators.required],
      fechaFin: [this.getDefaultEndDate(), Validators.required],
      tipoMovimiento: ['TODOS'],
      productoIds: [[]],
      usuarioIds: [[]],
      categoriaIds: [[]],
      incluirMasivos: [true],
      soloStockCritico: [false],
      motivoFiltro: ['']
    });

    // Formulario de configuración de reporte
    this.configReporteForm = this.fb.group({
      tipoReporte: ['DETALLADO', Validators.required],
      incluirGraficas: [true],
      incluirTablas: [true],
      incluirEstadisticas: [true],
      incluirResumen: [true],
      formatoExportacion: ['PDF', Validators.required],
      nombreReporte: ['Reporte_Movimientos', Validators.required],
      descripcionReporte: [''],
      incluirFiltrosAplicados: [true],
      ordenarPor: ['fecha'],
      direccionOrden: ['desc']
    });
  }

  /**
   * Obtener fecha por defecto de inicio (30 días atrás)
   */
  private getDefaultStartDate(): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - 30);
    return fecha.toISOString().split('T')[0];
  }

  /**
   * Obtener fecha por defecto de fin (hoy)
   */
  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Cargar datos iniciales
   */
  private loadInitialData(): void {
    this.isLoadingData.set(true);
    this.error.set(null);

    forkJoin([
      this.productosService.obtenerTodos(),
      this.usuariosService.obtenerTodos(),
      this.categoriasService.obtenerTodas()
    ]).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error cargando datos iniciales:', error);
        this.error.set('Error al cargar los datos iniciales');
        this.notificationService.error('Error al cargar los datos del sistema');
        return of([[], [], []] as [ProductoResponse[], UsuarioResponse[], CategoriaResponse[]]);
      }),
      finalize(() => this.isLoadingData.set(false))
    ).subscribe(result => {
      const [productos, usuarios, categorias] = result;
      this.productos.set(productos);
      this.usuarios.set(usuarios);
      this.categorias.set(categorias);

      console.log('✅ Datos iniciales cargados:', {
        productos: productos.length,
        usuarios: usuarios.length,
        categorias: categorias.length
      });
    });
  }

  /**
   * Configurar suscripciones a cambios en formularios
   */
  private setupFormSubscriptions(): void {
    // Reaccionar a cambios en filtros
    this.filtrosForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      if (this.reporteGenerado()) {
        console.log('Filtros cambiaron, invalidando reporte actual');
        this.reporteGenerado.set(false);
      }
    });

    // Validar fechas
    combineLatest([
      this.filtrosForm.get('fechaInicio')!.valueChanges,
      this.filtrosForm.get('fechaFin')!.valueChanges
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([inicio, fin]) => {
      this.validateDateRange(inicio, fin);
    });
  }

  /**
   * Validar rango de fechas
   */
  private validateDateRange(fechaInicio: string, fechaFin: string): void {
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);

      if (inicio > fin) {
        this.filtrosForm.get('fechaFin')?.setErrors({ 'fechaInvalida': true });
        this.notificationService.warning('La fecha de fin debe ser posterior a la fecha de inicio');
      } else {
        this.filtrosForm.get('fechaFin')?.setErrors(null);
      }

      // Validar que no sea más de 1 año
      const diffTime = Math.abs(fin.getTime() - inicio.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 365) {
        this.notificationService.warning('El rango de fechas no puede ser mayor a 1 año');
      }
    }
  }

  // ===== GENERACIÓN DE REPORTES =====

  /**
   * Generar reporte completo
   */
  async generarReporte(): Promise<void> {
    if (!this.canGenerateReports()) {
      this.notificationService.error('No tienes permisos para generar reportes');
      return;
    }

    if (this.filtrosForm.invalid) {
      this.notificationService.warning('Verifica los filtros antes de generar el reporte');
      Object.keys(this.filtrosForm.controls).forEach(key => {
        const control = this.filtrosForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isGeneratingReport.set(true);
    this.error.set(null);

    try {
      console.log('🔄 Iniciando generación de reporte...');

      // 1. Cargar movimientos con filtros
      await this.cargarMovimientosConFiltros();

      // 2. Generar estadísticas
      await this.generarEstadisticas();

      // 3. Calcular métricas avanzadas
      await this.calcularMetricas();

      // 4. Generar resumen de productos
      await this.generarResumenProductos();

      // 5. Actualizar gráficas
      this.actualizarTodasLasGraficas();

      this.reporteGenerado.set(true);
      this.fechaUltimaGeneracion.set(new Date());

      this.notificationService.success('Reporte generado exitosamente');
      console.log('✅ Reporte generado completamente');

    } catch (error) {
      console.error('❌ Error generando reporte:', error);
      this.error.set('Error al generar el reporte');
      this.notificationService.error('Error al generar el reporte');
    } finally {
      this.isGeneratingReport.set(false);
    }
  }

  /**
   * Cargar movimientos aplicando filtros
   */
  private async cargarMovimientosConFiltros(): Promise<void> {
    const filtros = this.filtrosForm.value;

    const movimientosFiltros: MovimientoFiltros = {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin
    };

    if (filtros.tipoMovimiento !== 'TODOS') {
      movimientosFiltros.tipoMovimiento = filtros.tipoMovimiento;
    }

    if (filtros.motivoFiltro?.trim()) {
      movimientosFiltros.motivo = filtros.motivoFiltro.trim();
    }

    return new Promise((resolve, reject) => {
      this.movimientosService.obtenerTodos().pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          reject(error);
          return of([]);
        })
      ).subscribe(movimientos => {
        // Aplicar filtros adicionales en el frontend
        let movimientosFiltrados = this.aplicarFiltrosAvanzados(movimientos, filtros);

        this.movimientos.set(movimientosFiltrados);
        console.log(`📊 Cargados ${movimientosFiltrados.length} movimientos filtrados`);
        resolve();
      });
    });
  }

  /**
   * Aplicar filtros avanzados en el frontend
   */
  private aplicarFiltrosAvanzados(movimientos: MovimientoResponse[], filtros: any): MovimientoResponse[] {
    let resultado = [...movimientos];

    // Filtrar por rango de fechas
    if (filtros.fechaInicio && filtros.fechaFin) {
      const fechaInicio = new Date(filtros.fechaInicio);
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999); // Incluir todo el día final

      resultado = resultado.filter(mov => {
        const fechaMov = new Date(mov.fecha);
        return fechaMov >= fechaInicio && fechaMov <= fechaFin;
      });
    }

    // Filtrar por productos seleccionados
    if (filtros.productoIds?.length > 0) {
      resultado = resultado.filter(mov =>
        filtros.productoIds.includes(mov.producto.id)
      );
    }

    // Filtrar por usuarios seleccionados
    if (filtros.usuarioIds?.length > 0) {
      resultado = resultado.filter(mov =>
        filtros.usuarioIds.includes(mov.usuario.id)
      );
    }

    // Filtrar por categorías seleccionadas
    if (filtros.categoriaIds?.length > 0) {
      resultado = resultado.filter(mov => {
        const categoriaId = this.productos().find(p => p.id === mov.producto.id)?.categoria.id;
        return filtros.categoriaIds.includes(categoriaId);
      });
    }

    // Filtrar movimientos masivos
    if (!filtros.incluirMasivos) {
      resultado = resultado.filter(mov => !mov.esMovimientoMasivo);
    }

    // Filtrar solo productos con stock crítico
    if (filtros.soloStockCritico) {
      resultado = resultado.filter(mov => {
        const producto = this.productos().find(p => p.id === mov.producto.id);
        return producto && producto.stockActual <= producto.stockMinimo;
      });
    }

    return resultado;
  }

  /**
   * Generar estadísticas generales
   */
  private async generarEstadisticas(): Promise<void> {
    const movimientos = this.movimientos();
    const filtros = this.filtrosForm.value;

    const params: MovimientoEstadisticasParams = {
      inicio: filtros.fechaInicio,
      fin: filtros.fechaFin
    };

    return new Promise((resolve, reject) => {
      this.movimientosService.obtenerEstadisticas(params).pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          // Si falla la API, calcular estadísticas localmente
          console.warn('Calculando estadísticas localmente:', error);
          const statsLocales = this.calcularEstadisticasLocales(movimientos, params);
          this.estadisticasGenerales.set(statsLocales);
          resolve();
          return of(null);
        })
      ).subscribe(estadisticas => {
        if (estadisticas) {
          this.estadisticasGenerales.set(estadisticas);
        }
        resolve();
      });
    });
  }

  /**
   * Calcular estadísticas localmente
   */
  private calcularEstadisticasLocales(movimientos: MovimientoResponse[], params: MovimientoEstadisticasParams): MovimientoEstadisticas {
    const entradas = movimientos.filter(m => m.tipoMovimiento === 'ENTRADA');
    const salidas = movimientos.filter(m => m.tipoMovimiento === 'SALIDA');

    const unidadesEntradas = entradas.reduce((sum, m) => sum + m.cantidad, 0);
    const unidadesSalidas = salidas.reduce((sum, m) => sum + m.cantidad, 0);
    const totalMovimientos = movimientos.length;

    return {
      fechaInicio: params.inicio,
      fechaFin: params.fin,
      totalMovimientos,
      cantidadEntradas: entradas.length,
      cantidadSalidas: salidas.length,
      unidadesEntradas,
      unidadesSalidas,
      diferenciaNeta: unidadesEntradas - unidadesSalidas,
      porcentajeEntradas: totalMovimientos > 0 ? (entradas.length / totalMovimientos) * 100 : 0,
      porcentajeSalidas: totalMovimientos > 0 ? (salidas.length / totalMovimientos) * 100 : 0
    };
  }

  /**
   * Calcular métricas avanzadas
   */
  private async calcularMetricas(): Promise<void> {
    const movimientos = this.movimientos();
    const productos = this.productos();
    const usuarios = this.usuarios();
    const estadisticas = this.estadisticasGenerales();

    if (!estadisticas) return;

    // Calcular valor total movido
    const valorTotalMovido = movimientos.reduce((sum, mov) => sum + mov.valorMovimiento, 0);

    // Calcular promedio de movimientos por día
    const fechaInicio = new Date(estadisticas.fechaInicio);
    const fechaFin = new Date(estadisticas.fechaFin);
    const diasEnRango = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const promedioMovimientosPorDia = estadisticas.totalMovimientos / diasEnRango;

    // Contar productos únicos afectados
    const productosAfectados = new Set(movimientos.map(m => m.producto.id)).size;

    // Contar usuarios únicos activos
    const usuariosActivos = new Set(movimientos.map(m => m.usuario.id)).size;

    // Categorías más activas
    const movimientosPorCategoria = new Map<string, number>();
    movimientos.forEach(mov => {
      const categoria = mov.producto.nombreCategoria;
      movimientosPorCategoria.set(categoria, (movimientosPorCategoria.get(categoria) || 0) + 1);
    });

    const categoriasMasActivas = Array.from(movimientosPorCategoria.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([categoria]) => categoria);

    // Determinar tendencia (simplificada)
    const tendenciaMensual = this.calcularTendencia(movimientos);

    const metricas: ReporteMetricas = {
      totalMovimientos: estadisticas.totalMovimientos,
      totalEntradas: estadisticas.cantidadEntradas,
      totalSalidas: estadisticas.cantidadSalidas,
      unidadesEntradas: estadisticas.unidadesEntradas,
      unidadesSalidas: estadisticas.unidadesSalidas,
      valorTotalMovido,
      diferenciaUnidades: estadisticas.diferenciaNeta,
      porcentajeEntradas: estadisticas.porcentajeEntradas,
      porcentajeSalidas: estadisticas.porcentajeSalidas,
      promedioMovimientosPorDia,
      productosAfectados,
      usuariosActivos,
      categoriasMasActivas,
      tendenciaMensual
    };

    this.metricas.set(metricas);
    console.log('📈 Métricas calculadas:', metricas);
  }

  /**
   * Calcular tendencia simplificada
   */
  private calcularTendencia(movimientos: MovimientoResponse[]): 'CRECIENTE' | 'DECRECIENTE' | 'ESTABLE' {
    if (movimientos.length < 10) return 'ESTABLE';

    // Dividir en dos mitades y comparar
    const sorted = movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const mitad = Math.floor(sorted.length / 2);
    const primeraMetad = sorted.slice(0, mitad);
    const segundaMetad = sorted.slice(mitad);

    const avgPrimera = primeraMetad.length / this.getDaysSpan(primeraMetad);
    const avgSegunda = segundaMetad.length / this.getDaysSpan(segundaMetad);

    const diferencia = ((avgSegunda - avgPrimera) / avgPrimera) * 100;

    if (diferencia > 10) return 'CRECIENTE';
    if (diferencia < -10) return 'DECRECIENTE';
    return 'ESTABLE';
  }

  /**
   * Obtener span de días de una lista de movimientos
   */
  private getDaysSpan(movimientos: MovimientoResponse[]): number {
    if (movimientos.length === 0) return 1;

    const fechas = movimientos.map(m => new Date(m.fecha).getTime());
    const min = Math.min(...fechas);
    const max = Math.max(...fechas);

    return Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24)) + 1);
  }

  /**
   * Generar resumen detallado de productos
   */
  private async generarResumenProductos(): Promise<void> {
    const movimientos = this.movimientos();
    const productos = this.productos();

    const resumenMap = new Map<number, ReporteResumenProducto>();

    // Inicializar resumen para cada producto afectado
    const productosAfectados = new Set(movimientos.map(m => m.producto.id));

    productosAfectados.forEach(productoId => {
      const producto = productos.find(p => p.id === productoId);
      if (!producto) return;

      const movimientosProducto = movimientos.filter(m => m.producto.id === productoId);
      const entradas = movimientosProducto.filter(m => m.tipoMovimiento === 'ENTRADA');
      const salidas = movimientosProducto.filter(m => m.tipoMovimiento === 'SALIDA');

      const totalEntradas = entradas.reduce((sum, m) => sum + m.cantidad, 0);
      const totalSalidas = salidas.reduce((sum, m) => sum + m.cantidad, 0);
      const stockCalculado = producto.stockActual;

      // Calcular días sin movimiento
      const ultimoMovimiento = movimientosProducto.length > 0
        ? Math.max(...movimientosProducto.map(m => new Date(m.fecha).getTime()))
        : 0;
      const diasSinMovimiento = ultimoMovimiento > 0
        ? Math.floor((Date.now() - ultimoMovimiento) / (1000 * 60 * 60 * 24))
        : 999;

      // Calcular rotación de stock (simplificada)
      const rotacionStock = totalSalidas > 0 && producto.stockActual > 0
        ? Math.round((totalSalidas / producto.stockActual) * 100) / 100
        : 0;

      // Determinar criticidad
      let criticidad: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      if (producto.stockActual <= 0 || diasSinMovimiento > 90) {
        criticidad = 'ALTA';
      } else if (producto.stockActual <= producto.stockMinimo || diasSinMovimiento > 30) {
        criticidad = 'MEDIA';
      }

      const resumen: ReporteResumenProducto = {
        productoId,
        nombreProducto: producto.nombre,
        stockActual: producto.stockActual,
        stockMinimo: producto.stockMinimo,
        totalEntradas,
        totalSalidas,
        stockCalculado,
        estadoStock: producto.stockActual <= 0 ? 'CRITICO'
                    : producto.stockActual <= producto.stockMinimo ? 'BAJO'
                    : 'NORMAL',
        stockConsistente: true, // Simplificado
        valorInventario: producto.precio * producto.stockActual,
        rotacionStock,
        diasSinMovimiento,
        criticidad
      };

      resumenMap.set(productoId, resumen);
    });

    const resumenArray = Array.from(resumenMap.values())
      .sort((a, b) => {
        // Ordenar por criticidad primero, luego por valor de inventario
        if (a.criticidad !== b.criticidad) {
          const orden = { 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
          return orden[b.criticidad] - orden[a.criticidad];
        }
        return b.valorInventario - a.valorInventario;
      });

    this.resumenProductos.set(resumenArray);
    console.log(`📦 Resumen de ${resumenArray.length} productos generado`);
  }

  /**
   * Actualizar todas las gráficas
   */
  private actualizarTodasLasGraficas(): void {
    console.log('📊 Actualizando todas las gráficas...');

    try {
      this.actualizarGraficaResumenGeneral();
      this.actualizarGraficaTendenciaTemporal();
      this.actualizarGraficaDistribucionCategorias();
      this.actualizarGraficaTopProductos();
      this.actualizarGraficaRendimientoUsuarios();
      this.actualizarGraficaComparativoMensual();

      // Forzar actualización después de un delay
      setTimeout(() => this.forzarActualizacionGraficas(), 300);

    } catch (error) {
      console.error('Error actualizando gráficas:', error);
    }
  }

  /**
   * Actualizar gráfica de resumen general
   */
  private actualizarGraficaResumenGeneral(): void {
    const estadisticas = this.estadisticasGenerales();
    if (!estadisticas) return;

    this.chartResumenGeneralData.datasets[0].data = [
      estadisticas.cantidadEntradas,
      estadisticas.cantidadSalidas
    ];
  }

  /**
   * Actualizar gráfica de tendencia temporal
   */
  private actualizarGraficaTendenciaTemporal(): void {
    const movimientos = this.movimientos();
    if (movimientos.length === 0) return;

    // Agrupar por día
    const movimientosPorDia = new Map<string, { entradas: number, salidas: number }>();

    movimientos.forEach(mov => {
      const fecha = new Date(mov.fecha).toISOString().split('T')[0];
      if (!movimientosPorDia.has(fecha)) {
        movimientosPorDia.set(fecha, { entradas: 0, salidas: 0 });
      }

      const data = movimientosPorDia.get(fecha)!;
      if (mov.tipoMovimiento === 'ENTRADA') {
        data.entradas++;
      } else {
        data.salidas++;
      }
    });

    // Ordenar fechas
    const fechasOrdenadas = Array.from(movimientosPorDia.keys()).sort();

    this.chartTendenciaTemporalData.labels = fechasOrdenadas.map(fecha =>
      new Date(fecha).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
    );

    this.chartTendenciaTemporalData.datasets[0].data = fechasOrdenadas.map(fecha =>
      movimientosPorDia.get(fecha)?.entradas || 0
    );

    this.chartTendenciaTemporalData.datasets[1].data = fechasOrdenadas.map(fecha =>
      movimientosPorDia.get(fecha)?.salidas || 0
    );
  }

  /**
   * Actualizar gráfica de distribución por categorías
   */
  private actualizarGraficaDistribucionCategorias(): void {
    const movimientos = this.movimientos();
    if (movimientos.length === 0) return;

    const movimientosPorCategoria = new Map<string, number>();

    movimientos.forEach(mov => {
      const categoria = mov.producto.nombreCategoria;
      movimientosPorCategoria.set(categoria, (movimientosPorCategoria.get(categoria) || 0) + 1);
    });

    const categoriasOrdenadas = Array.from(movimientosPorCategoria.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10

    this.chartDistribucionCategoriasData.labels = categoriasOrdenadas.map(([categoria]) => categoria);
    this.chartDistribucionCategoriasData.datasets[0].data = categoriasOrdenadas.map(([,cantidad]) => cantidad);
  }

  /**
   * Actualizar gráfica de top productos
   */
  private actualizarGraficaTopProductos(): void {
    const movimientos = this.movimientos();
    if (movimientos.length === 0) return;

    const movimientosPorProducto = new Map<string, number>();

    movimientos.forEach(mov => {
      const producto = mov.producto.nombre;
      movimientosPorProducto.set(producto, (movimientosPorProducto.get(producto) || 0) + 1);
    });

    const productosOrdenados = Array.from(movimientosPorProducto.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10

    this.chartTopProductosData.labels = productosOrdenados.map(([producto]) =>
      producto.length > 20 ? producto.substring(0, 17) + '...' : producto
    );
    this.chartTopProductosData.datasets[0].data = productosOrdenados.map(([,cantidad]) => cantidad);
  }

  /**
   * Actualizar gráfica de rendimiento de usuarios
   */
  private actualizarGraficaRendimientoUsuarios(): void {
    const movimientos = this.movimientos();
    if (movimientos.length === 0) return;

    const movimientosPorUsuario = new Map<string, number>();

    movimientos.forEach(mov => {
      const usuario = mov.usuario.nombreCompleto;
      movimientosPorUsuario.set(usuario, (movimientosPorUsuario.get(usuario) || 0) + 1);
    });

    const usuariosOrdenados = Array.from(movimientosPorUsuario.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8); // Top 8 para mejor visualización en radar

    this.chartRendimientoUsuariosData.labels = usuariosOrdenados.map(([usuario]) =>
      usuario.split(' ').map(n => n.charAt(0)).join('')
    );
    this.chartRendimientoUsuariosData.datasets[0].data = usuariosOrdenados.map(([,cantidad]) => cantidad);
  }

  /**
   * Actualizar gráfica comparativo mensual
   */
  private actualizarGraficaComparativoMensual(): void {
    const movimientos = this.movimientos();
    if (movimientos.length === 0) return;

    // Agrupar por mes
    const movimientosPorMes = new Map<string, { entradas: number, salidas: number, unidadesEntradas: number, unidadesSalidas: number }>();

    movimientos.forEach(mov => {
      const fecha = new Date(mov.fecha);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

      if (!movimientosPorMes.has(mes)) {
        movimientosPorMes.set(mes, { entradas: 0, salidas: 0, unidadesEntradas: 0, unidadesSalidas: 0 });
      }

      const data = movimientosPorMes.get(mes)!;
      if (mov.tipoMovimiento === 'ENTRADA') {
        data.entradas++;
        data.unidadesEntradas += mov.cantidad;
      } else {
        data.salidas++;
        data.unidadesSalidas += mov.cantidad;
      }
    });

    const mesesOrdenados = Array.from(movimientosPorMes.keys()).sort();

    this.chartComparativoMensualData.labels = mesesOrdenados.map(mes => {
      const [year, month] = mes.split('-');
      const fecha = new Date(parseInt(year), parseInt(month) - 1);
      return fecha.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
    });

    this.chartComparativoMensualData.datasets[0].data = mesesOrdenados.map(mes =>
      movimientosPorMes.get(mes)?.unidadesEntradas || 0
    );

    this.chartComparativoMensualData.datasets[1].data = mesesOrdenados.map(mes =>
      movimientosPorMes.get(mes)?.unidadesSalidas || 0
    );

    this.chartComparativoMensualData.datasets[2].data = mesesOrdenados.map(mes => {
      const data = movimientosPorMes.get(mes);
      return data ? data.unidadesEntradas - data.unidadesSalidas : 0;
    });
  }

  /**
   * Forzar actualización de todas las gráficas
   */
  private forzarActualizacionGraficas(): void {
    const graficas = [
      { ref: this.chartResumenGeneral, data: this.chartResumenGeneralData, name: 'Resumen General' },
      { ref: this.chartTendenciaTemporal, data: this.chartTendenciaTemporalData, name: 'Tendencia Temporal' },
      { ref: this.chartDistribucionCategorias, data: this.chartDistribucionCategoriasData, name: 'Distribución Categorías' },
      { ref: this.chartTopProductos, data: this.chartTopProductosData, name: 'Top Productos' },
      { ref: this.chartRendimientoUsuarios, data: this.chartRendimientoUsuariosData, name: 'Rendimiento Usuarios' },
      { ref: this.chartComparativoMensual, data: this.chartComparativoMensualData, name: 'Comparativo Mensual' }
    ];

    graficas.forEach(({ ref, data, name }) => {
      try {
        if (ref?.chart) {
          ref.chart.data = data;
          ref.chart.update('active');
          console.log(`✅ Gráfica ${name} actualizada`);
        } else {
          console.warn(`⚠️ Referencia a gráfica ${name} no disponible`);
        }
      } catch (error) {
        console.error(`❌ Error actualizando gráfica ${name}:`, error);
      }
    });
  }

  // ===== NAVEGACIÓN =====

  /**
   * Navegar a resumen de stock
   */
  navegarAResumenStock(): void {
    console.log('🔄 Navegando a resumen de stock...');
    this.router.navigate(['/movimientos/resumen-stock']);
  }

  /**
   * Navegar a estadísticas
   */
  navegarAEstadisticas(): void {
    this.router.navigate(['/movimientos/estadisticas']);
  }

  /**
   * Navegar a historial
   */
  navegarAHistorial(): void {
    this.router.navigate(['/movimientos/historial']);
  }

  // ===== EXPORTACIÓN =====

  /**
   * Exportar reporte
   */
  async exportarReporte(): Promise<void> {
    if (!this.reporteGenerado()) {
      this.notificationService.warning('Genera el reporte antes de exportar');
      return;
    }

    if (!this.canExportReports()) {
      this.notificationService.error('No tienes permisos para exportar reportes');
      return;
    }

    const config = this.configReporteForm.value as ReporteConfig;
    this.isExporting.set(true);

    try {
      console.log('📤 Iniciando exportación de reporte...', config);

      switch (config.formatoExportacion) {
        case 'PDF':
          await this.exportarPDF();
          break;
        case 'EXCEL':
          await this.exportarExcel();
          break;
        case 'AMBOS':
          await this.exportarPDF();
          await this.exportarExcel();
          break;
      }

      this.notificationService.success('Reporte exportado exitosamente');
      console.log('✅ Exportación completada');

    } catch (error) {
      console.error('❌ Error exportando reporte:', error);
      this.notificationService.error('Error al exportar el reporte');
    } finally {
      this.isExporting.set(false);
    }
  }

  /**
   * Exportar a PDF
   */
  private async exportarPDF(): Promise<void> {
    try {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const jsPDF = (jsPDFModule as any).default || jsPDFModule.jsPDF || jsPDFModule;
      const doc = new jsPDF('p', 'mm', 'a4');

      const config = this.configReporteForm.value;
      const movimientos = this.movimientos();
      const estadisticas = this.estadisticasGenerales();
      const metricas = this.metricas();

      let yPosition = 20;

      // Título principal
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text('REPORTE DE MOVIMIENTOS', 20, yPosition);
      yPosition += 15;

      // Información del reporte
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Tipo: ${config.tipoReporte}`, 20, yPosition);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, 120, yPosition);
      yPosition += 8;

      const usuario = this.currentUser();
      if (usuario) {
        doc.text(`Por: ${usuario.nombreCompleto}`, 20, yPosition);
        yPosition += 8;
      }

      if (config.descripcionReporte) {
        doc.text(`Descripción: ${config.descripcionReporte}`, 20, yPosition);
        yPosition += 8;
      }

      yPosition += 5;

      // Filtros aplicados
      if (config.incluirFiltrosAplicados) {
        doc.setFont(undefined, 'bold');
        doc.text('FILTROS APLICADOS:', 20, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');

        const filtros = this.filtrosForm.value;
        doc.text(`• Período: ${filtros.fechaInicio} a ${filtros.fechaFin}`, 25, yPosition);
        yPosition += 5;

        if (filtros.tipoMovimiento !== 'TODOS') {
          doc.text(`• Tipo: ${filtros.tipoMovimiento}`, 25, yPosition);
          yPosition += 5;
        }

        if (filtros.productoIds?.length > 0) {
          doc.text(`• ${filtros.productoIds.length} producto(s) seleccionado(s)`, 25, yPosition);
          yPosition += 5;
        }

        yPosition += 5;
      }

      // Resumen ejecutivo
      if (config.incluirResumen && estadisticas && metricas) {
        doc.setFont(undefined, 'bold');
        doc.text('RESUMEN EJECUTIVO:', 20, yPosition);
        yPosition += 8;
        doc.setFont(undefined, 'normal');

        const resumenTexto = [
          `• Total de movimientos: ${estadisticas.totalMovimientos}`,
          `• Entradas: ${estadisticas.cantidadEntradas} (${estadisticas.porcentajeEntradas.toFixed(1)}%)`,
          `• Salidas: ${estadisticas.cantidadSalidas} (${estadisticas.porcentajeSalidas.toFixed(1)}%)`,
          `• Unidades movidas: ${estadisticas.unidadesEntradas + estadisticas.unidadesSalidas}`,
          `• Diferencia neta: ${estadisticas.diferenciaNeta} unidades`,
          `• Valor total movido: ${this.formatearPrecio(metricas.valorTotalMovido)}`,
          `• Productos afectados: ${metricas.productosAfectados}`,
          `• Usuarios activos: ${metricas.usuariosActivos}`,
          `• Promedio diario: ${metricas.promedioMovimientosPorDia.toFixed(1)} movimientos`,
          `• Tendencia: ${metricas.tendenciaMensual}`
        ];

        resumenTexto.forEach(linea => {
          doc.text(linea, 25, yPosition);
          yPosition += 5;
        });

        yPosition += 5;
      }

      // Estadísticas detalladas
      if (config.incluirEstadisticas && estadisticas) {
        if (yPosition > 220) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.text('ESTADÍSTICAS DETALLADAS:', 20, yPosition);
        yPosition += 10;

        try {
          (doc as any).autoTable({
            startY: yPosition,
            head: [['Métrica', 'Valor', 'Porcentaje']],
            body: [
              ['Total Movimientos', estadisticas.totalMovimientos.toString(), '100%'],
              ['Entradas', estadisticas.cantidadEntradas.toString(), `${estadisticas.porcentajeEntradas.toFixed(1)}%`],
              ['Salidas', estadisticas.cantidadSalidas.toString(), `${estadisticas.porcentajeSalidas.toFixed(1)}%`],
              ['Unidades Entrada', estadisticas.unidadesEntradas.toString(), '-'],
              ['Unidades Salida', estadisticas.unidadesSalidas.toString(), '-'],
              ['Diferencia Neta', estadisticas.diferenciaNeta.toString(), '-']
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [59, 130, 246] }
          });

          yPosition = (doc as any).lastAutoTable.finalY + 10;
        } catch (error) {
          console.warn('Error con autoTable, usando tabla básica');
          yPosition += 40;
        }
      }

      // Tabla de movimientos (muestra)
      if (config.incluirTablas && movimientos.length > 0) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.text('ÚLTIMOS MOVIMIENTOS:', 20, yPosition);
        yPosition += 10;

        const movimientosMuestra = movimientos.slice(0, 20); // Solo primeros 20

        try {
          (doc as any).autoTable({
            startY: yPosition,
            head: [['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Usuario']],
            body: movimientosMuestra.map(mov => [
              new Date(mov.fecha).toLocaleDateString('es-CO'),
              mov.tipoMovimiento,
              mov.producto.nombre.length > 25 ? mov.producto.nombre.substring(0, 22) + '...' : mov.producto.nombre,
              mov.cantidad.toString(),
              mov.usuario.nombreCompleto.length > 20 ? mov.usuario.nombreCompleto.substring(0, 17) + '...' : mov.usuario.nombreCompleto
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 25 },
              1: { cellWidth: 20 },
              2: { cellWidth: 60 },
              3: { cellWidth: 20 },
              4: { cellWidth: 45 }
            }
          });
        } catch (error) {
          console.warn('Error con tabla de movimientos');
        }
      }

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
        doc.text('Sistema de Inventario - Reporte Confidencial', 20, doc.internal.pageSize.height - 10);
      }

      // Generar nombre de archivo
      const fechaHoy = new Date().toISOString().split('T')[0];
      const nombreArchivo = `${config.nombreReporte || 'Reporte_Movimientos'}_${fechaHoy}.pdf`;

      doc.save(nombreArchivo);
      console.log('✅ PDF generado:', nombreArchivo);

    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      throw error;
    }
  }

  /**
   * Exportar a Excel
   */
  private async exportarExcel(): Promise<void> {
    try {
      const config = this.configReporteForm.value;
      const movimientos = this.movimientos();
      const estadisticas = this.estadisticasGenerales();
      const metricas = this.metricas();
      const resumenProductos = this.resumenProductos();

      const workbook = XLSX.utils.book_new();

      // Hoja 1: Resumen
      if (config.incluirResumen && estadisticas && metricas) {
        const resumenData = [
          ['REPORTE DE MOVIMIENTOS'],
          [''],
          ['Período:', `${this.filtrosForm.value.fechaInicio} a ${this.filtrosForm.value.fechaFin}`],
          ['Generado:', new Date().toLocaleDateString('es-CO')],
          ['Usuario:', this.currentUser()?.nombreCompleto || ''],
          [''],
          ['MÉTRICAS GENERALES'],
          ['Total Movimientos', estadisticas.totalMovimientos],
          ['Total Entradas', estadisticas.cantidadEntradas],
          ['Total Salidas', estadisticas.cantidadSalidas],
          ['Unidades Entrada', estadisticas.unidadesEntradas],
          ['Unidades Salida', estadisticas.unidadesSalidas],
          ['Diferencia Neta', estadisticas.diferenciaNeta],
          ['Valor Total Movido', metricas.valorTotalMovido],
          ['Productos Afectados', metricas.productosAfectados],
          ['Usuarios Activos', metricas.usuariosActivos],
          ['Promedio Diario', Math.round(metricas.promedioMovimientosPorDia * 100) / 100],
          ['Tendencia', metricas.tendenciaMensual],
          [''],
          ['CATEGORÍAS MÁS ACTIVAS'],
          ...metricas.categoriasMasActivas.map((cat, idx) => [`${idx + 1}. ${cat}`])
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen');
      }

      // Hoja 2: Movimientos detallados
      if (config.incluirTablas && movimientos.length > 0) {
        const movimientosData = movimientos.map(mov => ({
          'ID': mov.id,
          'Fecha': new Date(mov.fecha).toLocaleDateString('es-CO'),
          'Hora': new Date(mov.fecha).toLocaleTimeString('es-CO'),
          'Tipo': mov.tipoMovimiento,
          'Producto': mov.producto.nombre,
          'Categoría': mov.producto.nombreCategoria,
          'Cantidad': mov.cantidad,
          'Precio Unitario': mov.producto.precio,
          'Valor Total': mov.valorMovimiento,
          'Motivo': mov.motivo,
          'Usuario': mov.usuario.nombreCompleto,
          'Rol Usuario': mov.usuario.nombreRol,
          'Nivel Impacto': mov.nivelImpacto,
          'Es Masivo': mov.esMovimientoMasivo ? 'Sí' : 'No',
          'Categoría Motivo': mov.categoriaMotivo,
          'Tiempo Transcurrido': mov.tiempoTranscurrido
        }));

        const wsMovimientos = XLSX.utils.json_to_sheet(movimientosData);

        // Configurar anchos de columna
        const wscols = [
          { wch: 8 },   // ID
          { wch: 12 },  // Fecha
          { wch: 10 },  // Hora
          { wch: 10 },  // Tipo
          { wch: 30 },  // Producto
          { wch: 15 },  // Categoría
          { wch: 10 },  // Cantidad
          { wch: 15 },  // Precio
          { wch: 15 },  // Valor
          { wch: 30 },  // Motivo
          { wch: 20 },  // Usuario
          { wch: 15 },  // Rol
          { wch: 12 },  // Impacto
          { wch: 10 },  // Es Masivo
          { wch: 18 },  // Categoría Motivo
          { wch: 18 }   // Tiempo
        ];
        wsMovimientos['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, wsMovimientos, 'Movimientos');
      }

      // Hoja 3: Resumen por productos
      if (resumenProductos.length > 0) {
        const productosData = resumenProductos.map(prod => ({
          'Producto': prod.nombreProducto,
          'Stock Actual': prod.stockActual,
          'Stock Mínimo': prod.stockMinimo,
          'Total Entradas': prod.totalEntradas,
          'Total Salidas': prod.totalSalidas,
          'Estado Stock': prod.estadoStock,
          'Valor Inventario': prod.valorInventario,
          'Rotación Stock': prod.rotacionStock,
          'Días Sin Movimiento': prod.diasSinMovimiento,
          'Criticidad': prod.criticidad,
          'Stock Consistente': prod.stockConsistente ? 'Sí' : 'No'
        }));

        const wsProductos = XLSX.utils.json_to_sheet(productosData);

        const wscolsProductos = [
          { wch: 30 }, // Producto
          { wch: 12 }, // Stock Actual
          { wch: 12 }, // Stock Mínimo
          { wch: 15 }, // Entradas
          { wch: 15 }, // Salidas
          { wch: 15 }, // Estado
          { wch: 18 }, // Valor
          { wch: 15 }, // Rotación
          { wch: 18 }, // Días Sin Mov
          { wch: 12 }, // Criticidad
          { wch: 15 }  // Consistente
        ];
        wsProductos['!cols'] = wscolsProductos;

        XLSX.utils.book_append_sheet(workbook, wsProductos, 'Resumen Productos');
      }

      // Hoja 4: Análisis por categorías
      const movimientosParaCategorias = this.movimientos();
      if (movimientosParaCategorias.length > 0) {
        const categoriaAnalisis = new Map<string, {
          movimientos: number,
          entradas: number,
          salidas: number,
          unidadesEntradas: number,
          unidadesSalidas: number,
          valorTotal: number
        }>();

        movimientosParaCategorias.forEach(mov => {
          const categoria = mov.producto.nombreCategoria;
          if (!categoriaAnalisis.has(categoria)) {
            categoriaAnalisis.set(categoria, {
              movimientos: 0,
              entradas: 0,
              salidas: 0,
              unidadesEntradas: 0,
              unidadesSalidas: 0,
              valorTotal: 0
            });
          }

          const data = categoriaAnalisis.get(categoria)!;
          data.movimientos++;
          data.valorTotal += mov.valorMovimiento;

          if (mov.tipoMovimiento === 'ENTRADA') {
            data.entradas++;
            data.unidadesEntradas += mov.cantidad;
          } else {
            data.salidas++;
            data.unidadesSalidas += mov.cantidad;
          }
        });

        const categoriasData = Array.from(categoriaAnalisis.entries()).map(([categoria, data]) => ({
          'Categoría': categoria,
          'Total Movimientos': data.movimientos,
          'Entradas': data.entradas,
          'Salidas': data.salidas,
          'Unidades Entrada': data.unidadesEntradas,
          'Unidades Salida': data.unidadesSalidas,
          'Diferencia Neta': data.unidadesEntradas - data.unidadesSalidas,
          'Valor Total': data.valorTotal,
          'Promedio por Movimiento': Math.round(data.valorTotal / data.movimientos * 100) / 100
        }));

        const wsCategorias = XLSX.utils.json_to_sheet(categoriasData);
        XLSX.utils.book_append_sheet(workbook, wsCategorias, 'Análisis Categorías');
      }

      // Generar y descargar archivo
      const fechaHoy = new Date().toISOString().split('T')[0];
      const nombreArchivo = `${config.nombreReporte || 'Reporte_Movimientos'}_${fechaHoy}.xlsx`;

      XLSX.writeFile(workbook, nombreArchivo);
      console.log('✅ Excel generado:', nombreArchivo);

    } catch (error) {
      console.error('❌ Error generando Excel:', error);
      throw error;
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Formatear precio
   */
  formatearPrecio(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  }

  /**
   * Formatear número
   */
  formatearNumero(valor: number): string {
    return new Intl.NumberFormat('es-CO').format(valor);
  }

  /**
   * Formatear porcentaje
   */
  formatearPorcentaje(valor: number): string {
    return `${valor.toFixed(1)}%`;
  }

  /**
   * Obtener clase CSS según criticidad
   */
  getCriticidadClass(criticidad: 'ALTA' | 'MEDIA' | 'BAJA'): string {
    switch (criticidad) {
      case 'ALTA': return 'text-red-600 font-semibold';
      case 'MEDIA': return 'text-yellow-600 font-medium';
      case 'BAJA': return 'text-green-600';
      default: return '';
    }
  }

  /**
   * Obtener clase CSS según estado de stock
   */
  getEstadoStockClass(estado: 'NORMAL' | 'BAJO' | 'CRITICO'): string {
    switch (estado) {
      case 'CRITICO': return 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium';
      case 'BAJO': return 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium';
      case 'NORMAL': return 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium';
      default: return '';
    }
  }

  /**
   * Obtener clase CSS según tendencia
   */
  getTendenciaClass(tendencia: 'CRECIENTE' | 'DECRECIENTE' | 'ESTABLE'): string {
    switch (tendencia) {
      case 'CRECIENTE': return 'text-green-600 font-semibold';
      case 'DECRECIENTE': return 'text-red-600 font-semibold';
      case 'ESTABLE': return 'text-blue-600 font-medium';
      default: return '';
    }
  }

  /**
   * Obtener icono según tendencia
   */
  getTendenciaIcon(tendencia: 'CRECIENTE' | 'DECRECIENTE' | 'ESTABLE'): string {
    switch (tendencia) {
      case 'CRECIENTE': return '📈';
      case 'DECRECIENTE': return '📉';
      case 'ESTABLE': return '📊';
      default: return '📊';
    }
  }

  /**
   * Verificar si hay datos suficientes para generar reporte
   */
  hasDatosSuficientes(): boolean {
    return this.productos().length > 0 && this.usuarios().length > 0;
  }

  /**
   * Obtener mensaje de estado del reporte
   */
  getMensajeEstadoReporte(): string {
    if (this.isGeneratingReport()) {
      return 'Generando reporte...';
    }
    if (this.reporteGenerado()) {
      const fecha = this.fechaUltimaGeneracion();
      return fecha ? `Último reporte: ${fecha.toLocaleString('es-CO')}` : 'Reporte disponible';
    }
    if (!this.hasDatosSuficientes()) {
      return 'Cargando datos del sistema...';
    }
    return 'Listo para generar reporte';
  }

  /**
   * Obtener total de filtros activos
   */
  getTotalFiltrosActivos(): number {
    const filtros = this.filtrosForm.value;
    let total = 0;

    if (filtros.tipoMovimiento !== 'TODOS') total++;
    if (filtros.productoIds?.length > 0) total++;
    if (filtros.usuarioIds?.length > 0) total++;
    if (filtros.categoriaIds?.length > 0) total++;
    if (!filtros.incluirMasivos) total++;
    if (filtros.soloStockCritico) total++;
    if (filtros.motivoFiltro?.trim()) total++;

    return total;
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltros(): void {
    this.filtrosForm.patchValue({
      fechaInicio: this.getDefaultStartDate(),
      fechaFin: this.getDefaultEndDate(),
      tipoMovimiento: 'TODOS',
      productoIds: [],
      usuarioIds: [],
      categoriaIds: [],
      incluirMasivos: true,
      soloStockCritico: false,
      motivoFiltro: ''
    });

    this.reporteGenerado.set(false);
    this.notificationService.success('Filtros limpiados');
  }

  /**
   * Restablecer configuración de reporte
   */
  restablecerConfiguracion(): void {
    this.configReporteForm.patchValue({
      tipoReporte: 'DETALLADO',
      incluirGraficas: true,
      incluirTablas: true,
      incluirEstadisticas: true,
      incluirResumen: true,
      formatoExportacion: 'PDF',
      nombreReporte: 'Reporte_Movimientos',
      descripcionReporte: '',
      incluirFiltrosAplicados: true,
      ordenarPor: 'fecha',
      direccionOrden: 'desc'
    });

    this.notificationService.success('Configuración restablecida');
  }

  /**
   * Actualizar reporte automáticamente
   */
  actualizarReporteAutomatico(): void {
    if (this.reporteGenerado()) {
      console.log('🔄 Actualizando reporte automáticamente...');
      this.generarReporte();
    }
  }

  /**
   * Validar permisos para acción específica
   */
  validarPermisos(accion: 'generar' | 'exportar' | 'configurar'): boolean {
    switch (accion) {
      case 'generar':
        return this.canGenerateReports();
      case 'exportar':
        return this.canExportReports();
      case 'configurar':
        return this.isManager();
      default:
        return false;
    }
  }

  /**
   * Obtener configuraciones predefinidas de reporte
   */
  aplicarConfiguracionPredefinida(tipo: 'ejecutivo' | 'operativo' | 'completo'): void {
    switch (tipo) {
      case 'ejecutivo':
        this.configReporteForm.patchValue({
          tipoReporte: 'EJECUTIVO',
          incluirGraficas: true,
          incluirTablas: false,
          incluirEstadisticas: true,
          incluirResumen: true,
          formatoExportacion: 'PDF'
        });
        break;

      case 'operativo':
        this.configReporteForm.patchValue({
          tipoReporte: 'OPERATIVO',
          incluirGraficas: false,
          incluirTablas: true,
          incluirEstadisticas: false,
          incluirResumen: false,
          formatoExportacion: 'EXCEL'
        });
        break;

      case 'completo':
        this.configReporteForm.patchValue({
          tipoReporte: 'DETALLADO',
          incluirGraficas: true,
          incluirTablas: true,
          incluirEstadisticas: true,
          incluirResumen: true,
          formatoExportacion: 'AMBOS'
        });
        break;
    }

    this.notificationService.success(`Configuración ${tipo} aplicada`);
  }

  // ===== GETTERS PARA TEMPLATE =====

  get filtrosAplicados() {
    return this.getTotalFiltrosActivos();
  }

  get puedeGenerar() {
    return this.validarPermisos('generar') && this.hasDatosSuficientes() && !this.isGeneratingReport();
  }

  get puedeExportar() {
    return this.validarPermisos('exportar') && this.reporteGenerado() && !this.isExporting();
  }

  get estadoReporte() {
    return this.getMensajeEstadoReporte();
  }

  get datosParaGraficas() {
    return this.reporteGenerado() && this.movimientos().length > 0;
  }

  // ===== MÉTODOS PARA FILTROS EN TEMPLATE =====

  /**
   * Obtener productos por criticidad alta
   */
  getProductosCriticidadAlta(): number {
    return this.resumenProductos().filter(p => p.criticidad === 'ALTA').length;
  }

  /**
   * Obtener productos por criticidad media
   */
  getProductosCriticidadMedia(): number {
    return this.resumenProductos().filter(p => p.criticidad === 'MEDIA').length;
  }

  /**
   * Obtener productos por criticidad baja
   */
  getProductosCriticidadBaja(): number {
    return this.resumenProductos().filter(p => p.criticidad === 'BAJA').length;
  }
}
