import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, catchError, of, switchMap } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import { MovimientoResponse, TipoMovimiento } from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';

@Component({
  selector: 'app-movimiento-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movimiento-detail.component.html',
  styleUrl: './movimiento-detail.component.scss'
})
export class MovimientoDetailComponent implements OnInit, OnDestroy {
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  movimiento = signal<MovimientoResponse | null>(null);
  producto = signal<ProductoResponse | null>(null);
  movimientoId = signal<number | null>(null);
  isLoadingMovimiento = signal(true);
  isLoadingProducto = signal(false);
  error = signal<string | null>(null);
  movimientosRelacionados = signal<MovimientoResponse[]>([]);
  loadingRelacionados = signal(false);

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canViewDetails = computed(() => this.authService.isAuthenticated());

  // Información calculada del movimiento
  tiempoTranscurridoDetallado = computed(() => {
    const mov = this.movimiento();
    if (!mov) return '';

    const ahora = new Date();
    const fechaMovimiento = new Date(mov.fecha);
    const diferencia = ahora.getTime() - fechaMovimiento.getTime();

    const segundos = Math.floor(diferencia / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    const semanas = Math.floor(dias / 7);
    const meses = Math.floor(dias / 30);

    if (segundos < 60) return `Hace ${segundos} segundo${segundos !== 1 ? 's' : ''}`;
    if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
    if (dias < 7) return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    if (semanas < 4) return `Hace ${semanas} semana${semanas !== 1 ? 's' : ''}`;
    if (meses < 12) return `Hace ${meses} mes${meses !== 1 ? 'es' : ''}`;

    return `Hace más de un año`;
  });

  // Información del impacto en stock
  impactoStock = computed(() => {
    const mov = this.movimiento();
    const prod = this.producto();
    if (!mov || !prod) return null;

    const stockActual = prod.stockActual;
    const cantidad = mov.cantidad;

    if (mov.tipoMovimiento === 'ENTRADA') {
      return {
        tipo: 'positivo',
        stockAnterior: stockActual - cantidad,
        stockActual: stockActual,
        diferencia: `+${cantidad}`,
        mensaje: `El stock aumentó en ${cantidad} unidades`
      };
    } else {
      return {
        tipo: 'negativo',
        stockAnterior: stockActual + cantidad,
        stockActual: stockActual,
        diferencia: `-${cantidad}`,
        mensaje: `El stock disminuyó en ${cantidad} unidades`
      };
    }
  });

  ngOnInit(): void {
    this.loadMovimiento();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar movimiento desde la ruta
   */
  private loadMovimiento(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = Number(params.get('id'));
          if (!id || isNaN(id)) {
            this.error.set('ID de movimiento inválido');
            return of(null);
          }

          this.movimientoId.set(id);
          this.isLoadingMovimiento.set(true);
          this.error.set(null);

          return this.movimientosService.obtenerPorId(id);
        }),
        catchError(error => {
          console.error('Error al cargar movimiento:', error);
          if (error.message?.includes('no encontrado')) {
            this.error.set('Movimiento no encontrado');
          } else {
            this.error.set('Error al cargar el movimiento');
          }
          return of(null);
        })
      )
      .subscribe(movimiento => {
        this.isLoadingMovimiento.set(false);

        if (movimiento) {
          this.movimiento.set(movimiento);
          this.cargarProductoDetallado(movimiento.producto.id);
          this.cargarMovimientosRelacionados(movimiento.producto.id);
        }
      });
  }

  /**
   * Cargar información detallada del producto
   */
  private cargarProductoDetallado(productoId: number): void {
    this.isLoadingProducto.set(true);

    this.productosService.obtenerPorId(productoId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar producto:', error);
          return of(null);
        })
      )
      .subscribe(producto => {
        this.isLoadingProducto.set(false);
        this.producto.set(producto);
      });
  }

  /**
   * Cargar movimientos relacionados del mismo producto
   */
  private cargarMovimientosRelacionados(productoId: number): void {
    this.loadingRelacionados.set(true);

    this.movimientosService.obtenerPorProducto(productoId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar movimientos relacionados:', error);
          return of([]);
        })
      )
      .subscribe(movimientos => {
        // Filtrar el movimiento actual y tomar solo los últimos 5
        const movimientoActualId = this.movimientoId();
        const otrosMovimientos = movimientos
          .filter(m => m.id !== movimientoActualId)
          .slice(0, 5);

        this.movimientosRelacionados.set(otrosMovimientos);
        this.loadingRelacionados.set(false);
      });
  }

  /**
   * Navegar a lista de movimientos
   */
  volverALista(): void {
    this.router.navigate(['/movimientos']);
  }

  /**
   * Navegar a crear nuevo movimiento con el mismo producto
   */
  crearMovimientoSimilar(): void {
    const mov = this.movimiento();
    if (mov) {
      this.router.navigate(['/movimientos/crear'], {
        queryParams: {
          producto: mov.producto.id,
          tipo: mov.tipoMovimiento
        }
      });
    }
  }

  /**
   * Ver todos los movimientos de este producto
   */
  verMovimientosProducto(): void {
    const mov = this.movimiento();
    if (mov) {
      this.router.navigate(['/movimientos/por-producto'], {
        queryParams: { producto: mov.producto.id }
      });
    }
  }

  /**
   * Ver todos los movimientos de este usuario
   */
  verMovimientosUsuario(): void {
    const mov = this.movimiento();
    if (mov) {
      this.router.navigate(['/movimientos/por-usuario'], {
        queryParams: { usuario: mov.usuario.id }
      });
    }
  }

  /**
   * Ver detalle del producto
   */
  verDetalleProducto(): void {
    const mov = this.movimiento();
    if (mov) {
      this.router.navigate(['/productos', mov.producto.id]);
    }
  }

  /**
   * Ver detalle de otro movimiento
   */
  verDetalleMovimiento(movimientoId: number): void {
    this.router.navigate(['/movimientos', movimientoId]);
  }

  /**
   * Recargar datos del movimiento
   */
  recargar(): void {
    const id = this.movimientoId();
    if (id) {
      this.loadMovimiento();
    }
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
      case 'CRÍTICO': return 'text-red-600';
      case 'BAJO': return 'text-yellow-600';
      case 'NORMAL': return 'text-green-600';
      case 'ALTO': return 'text-blue-600';
      default: return 'text-gray-600';
    }
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
   * Formatear fecha completa
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formatear fecha corta para movimientos relacionados
   */
  formatearFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtener color del indicador de stock
   */
  getColorIndicadorStock(): string {
    const impacto = this.impactoStock();
    if (!impacto) return 'bg-gray-500';

    return impacto.tipo === 'positivo' ? 'bg-green-500' : 'bg-red-500';
  }

  /**
   * Obtener mensaje de estado del stock actual
   */
  getMensajeEstadoStock(): string {
    const prod = this.producto();
    if (!prod) return '';

    const stock = prod.stockActual;
    const minimo = prod.stockMinimo;

    if (stock <= 0) return 'Sin stock disponible';
    if (stock <= minimo) return 'Stock por debajo del mínimo';
    if (stock <= minimo * 1.5) return 'Stock bajo, considerar reposición';
    return 'Stock en nivel adecuado';
  }

  /**
   * Verificar si puede crear movimientos
   */
  puedeCrearMovimientos(): boolean {
    return this.authService.isManagerOrAbove();
  }

  /**
   * Obtener texto descriptivo del impacto
   */
  getTextoImpacto(): string {
    const mov = this.movimiento();
    if (!mov) return '';

    const cantidad = mov.cantidad;
    const tipo = mov.tipoMovimiento;
    const valor = mov.valorMovimiento;

    if (tipo === 'ENTRADA') {
      return `Se agregaron ${cantidad} unidades por un valor de ${this.formatearPrecio(valor)}`;
    } else {
      return `Se retiraron ${cantidad} unidades por un valor de ${this.formatearPrecio(valor)}`;
    }
  }

  /**
   * Obtener recomendaciones basadas en el movimiento
   */
  getRecomendaciones(): string[] {
    const mov = this.movimiento();
    const prod = this.producto();
    const impacto = this.impactoStock();

    if (!mov || !prod || !impacto) return [];

    const recomendaciones: string[] = [];

    // Recomendaciones para entradas
    if (mov.tipoMovimiento === 'ENTRADA') {
      if (prod.stockActual > prod.stockMinimo * 3) {
        recomendaciones.push('El stock está muy alto, considera revisar la demanda');
      }
      if (mov.valorMovimiento > 100000) {
        recomendaciones.push('Movimiento de alto valor, verificar en reportes financieros');
      }
    }

    // Recomendaciones para salidas
    if (mov.tipoMovimiento === 'SALIDA') {
      if (prod.stockActual <= prod.stockMinimo) {
        recomendaciones.push('Stock crítico, programar reposición urgente');
      } else if (prod.stockActual <= prod.stockMinimo * 1.5) {
        recomendaciones.push('Stock bajo, considerar hacer pedido pronto');
      }

      if (mov.cantidad >= prod.stockMinimo) {
        recomendaciones.push('Salida considerable, monitorear demanda del producto');
      }
    }

    return recomendaciones;
  }

  /**
   * TrackBy function para movimientos relacionados
   */
  trackByMovimiento(index: number, movimiento: MovimientoResponse): number {
    return movimiento.id;
  }
}
