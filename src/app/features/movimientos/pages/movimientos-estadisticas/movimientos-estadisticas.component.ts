import { Component, inject, signal, OnInit, OnDestroy, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';

// Chart.js imports
import { Chart, ChartConfiguration, ChartType, ChartOptions, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import {
  MovimientoEstadisticas,
  MovimientoEstadisticasParams,
  MovimientoResponse,
  TipoMovimiento
} from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { NotificationService } from '../../../../core/services/notification.service';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

// jsPDF imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-movimientos-estadisticas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './movimientos-estadisticas.component.html',
  styleUrl: './movimientos-estadisticas.component.scss'
})
export class MovimientosEstadisticasComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  // Referencias a las gráficas
  @ViewChild('chartMovimientos', { static: false }) chartMovimientos?: BaseChartDirective;
  @ViewChild('chartTipos', { static: false }) chartTipos?: BaseChartDirective;
  @ViewChild('chartUnidades', { static: false }) chartUnidades?: BaseChartDirective;
  @ViewChild('chartTendencia', { static: false }) chartTendencia?: BaseChartDirective;

  // ===== SIGNALS PARA ESTADO DEL COMPONENTE =====
  estadisticas = signal<MovimientoEstadisticas | null>(null);
  productos = signal<ProductoResponse[]>([]);
  movimientosTodos = signal<MovimientoResponse[]>([]);
  isLoadingEstadisticas = signal(false);
  isLoadingProductos = signal(true);
  isLoadingMovimientos = signal(true);
  error = signal<string | null>(null);
  periodoActual = signal<{ inicio: string; fin: string }>({
    inicio: this.getDefaultStartDate(),
    fin: this.getDefaultEndDate()
  });

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canViewAllData = computed(() => this.authService.isManagerOrAbove());
  showTrendChart = computed(() => {
    if (!this.filtrosForm) return true;
    const control = this.filtrosForm.get('verTendencia');
    return control ? control.value === true : true;
  });

  // ===== FORMULARIOS =====
  rangoFechasForm!: FormGroup;
  filtrosForm!: FormGroup;

  // ===== CONFIGURACIONES DE GRÁFICAS =====

  // Gráfica de barras - Movimientos por período
  chartMovimientosData: ChartConfiguration['data'] = {
    labels: ['Entradas', 'Salidas'],
    datasets: [{
      label: 'Cantidad de Movimientos',
      data: [0, 0],
      backgroundColor: ['#10b981', '#ef4444'],
      borderColor: ['#059669', '#dc2626'],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  chartMovimientosOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Movimientos por Tipo',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  // Gráfica circular - Distribución de tipos
  chartTiposData: ChartConfiguration['data'] = {
    labels: ['Entradas', 'Salidas'],
    datasets: [{
      data: [0, 0],
      backgroundColor: ['#10b981', '#ef4444'],
      borderColor: ['#ffffff'],
      borderWidth: 2
    }]
  };

  chartTiposOptions: ChartOptions = {
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
        text: 'Distribución de Movimientos',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  };

  // Gráfica de unidades
  chartUnidadesData: ChartConfiguration['data'] = {
    labels: ['Unidades Entrada', 'Unidades Salida'],
    datasets: [{
      label: 'Unidades',
      data: [0, 0],
      backgroundColor: ['#3b82f6', '#f59e0b'],
      borderColor: ['#2563eb', '#d97706'],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  chartUnidadesOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Volumen de Unidades',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  // Gráfica de línea - Tendencia temporal
  chartTendenciaData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Entradas',
        data: [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Salidas',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  chartTendenciaOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Tendencia de Movimientos',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
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
    const periodo = this.periodoActual();

    this.rangoFechasForm = this.fb.group({
      fechaInicio: [periodo.inicio, Validators.required],
      fechaFin: [periodo.fin, Validators.required]
    });

    this.filtrosForm = this.fb.group({
      periodoRapido: ['ultimo_mes'],
      incluirEntradas: [true],
      incluirSalidas: [true],
      verTendencia: [true]
    });

    // Asegurar que los filtros estén listos
    console.log('Formularios inicializados:', {
      rangoFechas: this.rangoFechasForm.value,
      filtros: this.filtrosForm.value
    });
  }

  /**
   * Cargar datos iniciales
   */
  private loadInitialData(): void {
    this.isLoadingProductos.set(true);
    this.isLoadingMovimientos.set(true);

    forkJoin({
      productos: this.productosService.obtenerTodos(),
      movimientos: this.movimientosService.obtenerTodos()
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error al cargar datos iniciales:', error);
        this.error.set('Error al cargar los datos. Por favor, intenta de nuevo.');
        return of({ productos: [], movimientos: [] });
      })
    ).subscribe(({ productos, movimientos }) => {
      this.productos.set(productos);
      this.movimientosTodos.set(movimientos);
      this.isLoadingProductos.set(false);
      this.isLoadingMovimientos.set(false);

      // Cargar estadísticas del período actual
      this.loadEstadisticas();
    });
  }

  /**
   * Configurar suscripciones a cambios en formularios
   */
  private setupFormSubscriptions(): void {
    // Cambios en período rápido
    this.filtrosForm.get('periodoRapido')!.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(periodo => {
        this.aplicarPeriodoRapido(periodo);
      });

    // Cambios en rango de fechas manual
    this.rangoFechasForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(valores => {
        if (this.rangoFechasForm.valid && valores.fechaInicio && valores.fechaFin) {
          this.periodoActual.set({
            inicio: valores.fechaInicio,
            fin: valores.fechaFin
          });
          this.loadEstadisticas();
        }
      });

    // Cambios en filtros de visualización
    this.filtrosForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((filtros) => {
        console.log('Filtros cambiados:', filtros); // Para debug
        this.applyVisualizationFilters();
      });
  }

  /**
   * Aplicar filtros de visualización sin recargar datos
   */
  private applyVisualizationFilters(): void {
    const stats = this.estadisticas();
    const filtros = this.filtrosForm.value;

    console.log('Aplicando filtros:', { stats, filtros }); // Debug

    if (!stats || !filtros) {
      console.log('No hay stats o filtros disponibles');
      return;
    }

    // Actualizar datos de gráficas según filtros
    this.chartMovimientosData.datasets[0].data = [
      filtros.incluirEntradas ? stats.cantidadEntradas : 0,
      filtros.incluirSalidas ? stats.cantidadSalidas : 0
    ];

    this.chartTiposData.datasets[0].data = [
      filtros.incluirEntradas ? stats.cantidadEntradas : 0,
      filtros.incluirSalidas ? stats.cantidadSalidas : 0
    ];

    this.chartUnidadesData.datasets[0].data = [
      filtros.incluirEntradas ? stats.unidadesEntradas : 0,
      filtros.incluirSalidas ? stats.unidadesSalidas : 0
    ];

    console.log('Datos actualizados:', {
      movimientos: this.chartMovimientosData.datasets[0].data,
      tipos: this.chartTiposData.datasets[0].data,
      unidades: this.chartUnidadesData.datasets[0].data
    });

    // Forzar actualización de gráficas
    setTimeout(() => this.forceChartsUpdate(), 50);
  }

  // ===== MÉTODOS PARA CARGAR DATOS =====

  /**
   * Cargar estadísticas del período actual
   */
  private loadEstadisticas(): void {
    const periodo = this.periodoActual();
    const params: MovimientoEstadisticasParams = {
      inicio: periodo.inicio,
      fin: periodo.fin
    };

    this.isLoadingEstadisticas.set(true);

    this.movimientosService.obtenerEstadisticas(params)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar estadísticas:', error);
          this.error.set('Error al cargar las estadísticas.');
          return of(null);
        })
      )
      .subscribe(estadisticas => {
        this.isLoadingEstadisticas.set(false);
        this.estadisticas.set(estadisticas);
        this.generateTrendData();

        // Cargar datos iniciales en las gráficas
        this.updateCharts();

        // Aplicar filtros después de un delay más largo
        setTimeout(() => this.applyVisualizationFilters(), 500);
        // Debug para verificar estado
        setTimeout(() => this.debugChartStates(), 1000);
      });
  }

  /**
   * Actualizar todas las gráficas
   */
  private updateCharts(): void {
    const stats = this.estadisticas();
    const filtros = this.filtrosForm.value;

    if (!stats || !filtros) return;

    // Actualizar gráfica de movimientos por tipo
    this.chartMovimientosData.datasets[0].data = [
      filtros.incluirEntradas ? stats.cantidadEntradas : 0,
      filtros.incluirSalidas ? stats.cantidadSalidas : 0
    ];

    // Actualizar gráfica circular
    this.chartTiposData.datasets[0].data = [
      filtros.incluirEntradas ? stats.cantidadEntradas : 0,
      filtros.incluirSalidas ? stats.cantidadSalidas : 0
    ];

    // Actualizar gráfica de unidades
    this.chartUnidadesData.datasets[0].data = [
      filtros.incluirEntradas ? stats.unidadesEntradas : 0,
      filtros.incluirSalidas ? stats.unidadesSalidas : 0
    ];

    // Actualizar gráficas en la vista
    setTimeout(() => {
      try {
        this.chartMovimientos?.chart?.update();
        this.chartTipos?.chart?.update();
        this.chartUnidades?.chart?.update();
        this.chartTendencia?.chart?.update();
      } catch (error) {
        console.warn('Error al actualizar gráficas:', error);
      }
    }, 200);
  }

  /**
  * Forzar actualización de gráficas con verificación
  */
  private forceChartsUpdate(): void {
    console.log('Forzando actualización de gráficas...');

    // Usar requestAnimationFrame para asegurar que el DOM esté listo
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (this.chartMovimientos?.chart) {
          this.chartMovimientos.chart.data = this.chartMovimientosData;
          this.chartMovimientos.chart.update('active');
          console.log('Chart movimientos actualizado');
        }

        if (this.chartTipos?.chart) {
          this.chartTipos.chart.data = this.chartTiposData;
          this.chartTipos.chart.update('active');
          console.log('Chart tipos actualizado');
        }

        if (this.chartUnidades?.chart) {
          this.chartUnidades.chart.data = this.chartUnidadesData;
          this.chartUnidades.chart.update('active');
          console.log('Chart unidades actualizado');
        }

        if (this.chartTendencia?.chart) {
          this.chartTendencia.chart.data = this.chartTendenciaData;
          this.chartTendencia.chart.update('active');
          console.log('Chart tendencia actualizado');
        }
      }, 100);
    });
  }

  /**
   * Método para verificar el estado de las gráficas (debug)
   */
  private debugChartStates(): void {
    console.log('Estado de las gráficas:', {
      movimientos: {
        existe: !!this.chartMovimientos,
        chart: !!this.chartMovimientos?.chart,
        data: this.chartMovimientosData.datasets[0].data
      },
      tipos: {
        existe: !!this.chartTipos,
        chart: !!this.chartTipos?.chart,
        data: this.chartTiposData.datasets[0].data
      },
      unidades: {
        existe: !!this.chartUnidades,
        chart: !!this.chartUnidades?.chart,
        data: this.chartUnidadesData.datasets[0].data
      },
      estadisticas: this.estadisticas()
    });
  }

  /**
   * Generar datos de tendencia temporal
   */
  private generateTrendData(): void {
    const movimientos = this.movimientosTodos();
    const periodo = this.periodoActual();

    if (!movimientos.length) return;

    // Filtrar movimientos por período
    const movimientosFiltrados = movimientos.filter(m => {
      const fechaMovimiento = new Date(m.fecha);
      const fechaInicio = new Date(periodo.inicio);
      const fechaFin = new Date(periodo.fin);
      return fechaMovimiento >= fechaInicio && fechaMovimiento <= fechaFin;
    });

    // Agrupar por días
    const groupedByDay = this.groupMovimientosByDay(movimientosFiltrados);

    // Preparar datos para la gráfica
    const labels = Object.keys(groupedByDay).sort();
    const entradasData = labels.map(date =>
      groupedByDay[date].filter(m => m.tipoMovimiento === 'ENTRADA').length
    );
    const salidasData = labels.map(date =>
      groupedByDay[date].filter(m => m.tipoMovimiento === 'SALIDA').length
    );

    this.chartTendenciaData.labels = labels.map(date =>
      new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
    );
    this.chartTendenciaData.datasets[0].data = entradasData;
    this.chartTendenciaData.datasets[1].data = salidasData;

    // Actualizar la gráfica de tendencia específicamente
    setTimeout(() => {
      if (this.chartTendencia?.chart) {
        this.chartTendencia.chart.data = this.chartTendenciaData;
        this.chartTendencia.chart.update('none');
      }
    }, 100);
  }

  /**
   * Agrupar movimientos por día
   */
  private groupMovimientosByDay(movimientos: MovimientoResponse[]): { [key: string]: MovimientoResponse[] } {
    return movimientos.reduce((groups, movimiento) => {
      const fecha = new Date(movimiento.fecha).toISOString().split('T')[0];
      if (!groups[fecha]) {
        groups[fecha] = [];
      }
      groups[fecha].push(movimiento);
      return groups;
    }, {} as { [key: string]: MovimientoResponse[] });
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Aplicar período rápido
   */
  private aplicarPeriodoRapido(periodo: string): void {
    const hoy = new Date();
    let fechaInicio: Date;
    let fechaFin: Date = hoy;

    switch (periodo) {
      case 'hoy':
        fechaInicio = new Date(hoy);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'esta_semana':
        fechaInicio = new Date(hoy);
        fechaInicio.setDate(hoy.getDate() - hoy.getDay());
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'este_mes':
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
      case 'ultimo_mes':
        fechaInicio = new Date(hoy);
        fechaInicio.setMonth(hoy.getMonth() - 1);
        break;
      case 'ultimos_3_meses':
        fechaInicio = new Date(hoy);
        fechaInicio.setMonth(hoy.getMonth() - 3);
        break;
      case 'este_año':
        fechaInicio = new Date(hoy.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    const formatoFecha = 'YYYY-MM-DDTHH:mm:ss';
    const inicio = this.formatDateForInput(fechaInicio);
    const fin = this.formatDateForInput(fechaFin);

    this.rangoFechasForm.patchValue({
      fechaInicio: inicio,
      fechaFin: fin
    });
  }

  /**
   * Obtener fecha de inicio por defecto (último mes)
   */
  private getDefaultStartDate(): string {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 1);
    return this.formatDateForInput(fecha);
  }

  /**
   * Obtener fecha de fin por defecto (hoy)
   */
  private getDefaultEndDate(): string {
    return this.formatDateForInput(new Date());
  }

  /**
   * Formatear fecha para input datetime-local
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // ===== MÉTODOS PÚBLICOS PARA TEMPLATE =====

  /**
   * Exportar estadísticas
   */
  exportarEstadisticas(): void {
    const stats = this.estadisticas();
    if (!stats) return;

    try {
      // Crear nuevo documento PDF
      const doc = new jsPDF();
      const currentDate = new Date().toLocaleDateString('es-ES');

      // Header del documento
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Estadísticas de Movimientos', 20, 25);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado el: ${currentDate}`, 20, 35);

      // Información del período
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Período de Análisis', 20, 55);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Desde: ${this.formatDate(stats.fechaInicio)}`, 20, 65);
      doc.text(`Hasta: ${this.formatDate(stats.fechaFin)}`, 20, 72);

      // Estadísticas principales (tabla manual)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen General', 20, 90);

      let yPos = 105;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const estadisticas = [
        ['Total de Movimientos:', this.formatNumber(stats.totalMovimientos)],
        ['Cantidad de Entradas:', this.formatNumber(stats.cantidadEntradas)],
        ['Cantidad de Salidas:', this.formatNumber(stats.cantidadSalidas)],
        ['Unidades de Entrada:', this.formatNumber(stats.unidadesEntradas)],
        ['Unidades de Salida:', this.formatNumber(stats.unidadesSalidas)],
        ['Diferencia Neta:', `${stats.diferenciaNeta >= 0 ? '+' : ''}${this.formatNumber(stats.diferenciaNeta)}`],
        ['Porcentaje Entradas:', `${stats.porcentajeEntradas.toFixed(1)}%`],
        ['Porcentaje Salidas:', `${stats.porcentajeSalidas.toFixed(1)}%`]
      ];

      estadisticas.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });

      // Análisis de rendimiento
      yPos += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Análisis de Rendimiento', 20, yPos);

      yPos += 15;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      // Análisis de balance
      const balanceText = stats.diferenciaNeta >= 0
        ? `✓ Balance positivo: Incremento neto de ${this.formatNumber(stats.diferenciaNeta)} unidades.`
        : `⚠ Balance negativo: Reducción neta de ${this.formatNumber(Math.abs(stats.diferenciaNeta))} unidades.`;

      doc.text(balanceText, 20, yPos);
      yPos += 10;

      // Análisis de distribución
      const tipoMayoritario = stats.cantidadEntradas > stats.cantidadSalidas ? 'entradas' : 'salidas';
      const porcentajeMayoritario = Math.max(stats.porcentajeEntradas, stats.porcentajeSalidas);

      doc.text(`• Movimiento predominante: ${tipoMayoritario} (${porcentajeMayoritario.toFixed(1)}%)`, 20, yPos);
      yPos += 7;

      // Análisis de volumen
      doc.text(`• Volumen total: ${this.formatNumber(stats.unidadesEntradas + stats.unidadesSalidas)} unidades`, 20, yPos);
      yPos += 7;

      // Recomendaciones
      if (stats.diferenciaNeta < 0) {
        doc.text('⚠ Recomendación: Revisar motivos de salidas para optimizar inventario.', 20, yPos);
      } else if (stats.cantidadSalidas === 0) {
        doc.text('ℹ Observación: No se registraron salidas en este período.', 20, yPos);
      } else {
        doc.text('✓ El inventario muestra un flujo saludable de movimientos.', 20, yPos);
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Sistema de Gestión de Inventario', 20, pageHeight - 20);
      doc.text(`Usuario: ${this.currentUser()?.nombreCompleto || 'Sistema'}`, 20, pageHeight - 15);

      // Guardar el archivo
      const fileName = `estadisticas_movimientos_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Mostrar notificación de éxito
      setTimeout(() => {
        this.notificationService?.success('Reporte exportado exitosamente', 'Exportación Completada');
      }, 0);

    } catch (error) {
      console.error('Error al exportar estadísticas:', error);
      setTimeout(() => {
        this.notificationService?.error('Error al generar el reporte PDF', 'Error de Exportación');
      }, 0);
    }
  }

  /**
   * Recargar datos
   */
  recargarDatos(): void {
    this.loadInitialData();
  }

  /**
   * Navegar a lista de movimientos
   */
  verTodosLosMovimientos(): void {
    this.router.navigate(['/movimientos']);
  }

  /**
   * Navegar a crear movimiento
   */
  crearNuevoMovimiento(): void {
    this.router.navigate(['/movimientos/crear']);
  }

  /**
   * Obtener clase CSS para diferencia neta
   */
  getDiferenciaNetaClass(): string {
    const stats = this.estadisticas();
    if (!stats) return 'text-neutral-600';

    if (stats.diferenciaNeta > 0) return 'text-green-600';
    if (stats.diferenciaNeta < 0) return 'text-red-600';
    return 'text-neutral-600';
  }

  /**
   * Obtener porcentaje de movimientos
   */
  getPorcentajeMovimientos(tipo: 'entradas' | 'salidas'): number {
    const stats = this.estadisticas();
    if (!stats || stats.totalMovimientos === 0) return 0;

    const cantidad = tipo === 'entradas' ? stats.cantidadEntradas : stats.cantidadSalidas;
    return Math.round((cantidad / stats.totalMovimientos) * 100);
  }

  /**
   * Formatear números con separadores de miles
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  /**
   * Formatear fechas para mostrar
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
