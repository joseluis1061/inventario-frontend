import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, throttleTime } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // BehaviorSubject principal para el estado de loading
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Subjects para manejar las acciones show/hide con debounce mejorado
  private showSubject = new Subject<void>();
  private hideSubject = new Subject<void>();

  // Contador de requests activos
  private activeRequests = 0;

  // Flag para evitar emitir el mismo valor consecutivamente
  private currentLoadingState = false;

  // Flag para evitar cambios durante detección de cambios
  private isProcessingChange = false;

  // Timer para auto-limpieza en caso de requests colgados
  private cleanupTimer: any = null;

  constructor() {
    this.setupDebouncedLoading();
  }

  /**
   * Configurar el sistema de debounced loading mejorado
   */
  private setupDebouncedLoading(): void {
    // Debounce MEJORADO para SHOW loading - más conservador
    this.showSubject.pipe(
      debounceTime(50), // Incrementado de 10ms a 50ms
      distinctUntilChanged(),
      throttleTime(100) // Agregado throttle para evitar cambios muy rápidos
    ).subscribe(() => {
      this.safeEmitLoadingState(true);
    });

    // Debounce MEJORADO para HIDE loading - más tiempo para estabilizar
    this.hideSubject.pipe(
      debounceTime(150), // Incrementado de 50ms a 150ms
      distinctUntilChanged(),
      throttleTime(200) // Agregado throttle más largo para hide
    ).subscribe(() => {
      // Verificar nuevamente el contador antes de ocultar
      if (this.activeRequests <= 0) {
        this.safeEmitLoadingState(false);
      }
    });
  }

  /**
   * Emitir el estado de loading de forma segura (evita cambios durante detección)
   */
  private safeEmitLoadingState(loading: boolean): void {
    // Evitar cambios durante detección de cambios
    if (this.isProcessingChange) {
      setTimeout(() => this.safeEmitLoadingState(loading), 0);
      return;
    }

    // Solo emitir si realmente cambió
    if (this.currentLoadingState !== loading) {
      this.isProcessingChange = true;

      // Usar setTimeout para diferir el cambio al siguiente ciclo
      setTimeout(() => {
        this.currentLoadingState = loading;
        this.loadingSubject.next(loading);
        this.isProcessingChange = false;

        // Log para debugging (opcional, remover en producción)
        console.log(`🔄 Loading state changed to: ${loading} (Active: ${this.activeRequests})`);
      }, 0);

      // Configurar timer de limpieza para requests colgados
      this.setupCleanupTimer(loading);
    }
  }

  /**
   * Configurar timer de auto-limpieza para evitar loading infinito
   */
  private setupCleanupTimer(loading: boolean): void {
    // Limpiar timer anterior
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Solo para estados de loading=true
    if (loading) {
      // Auto-limpieza después de 30 segundos (requests muy largos)
      this.cleanupTimer = setTimeout(() => {
        if (this.activeRequests > 0) {
          console.warn('⚠️ Loading cleanup: Forcing hide after 30s timeout');
          this.forceHide();
        }
      }, 30000);
    }
  }

  /**
   * Mostrar loading spinner (método mejorado)
   */
  show(): void {
    this.activeRequests++;

    // Log detallado para debugging
    console.log(`📈 Loading.show() called. Active requests: ${this.activeRequests}`);

    // Solo emitir show si no estamos ya mostrando loading
    if (!this.currentLoadingState) {
      this.showSubject.next();
    }
  }

  /**
   * Ocultar loading spinner (método mejorado)
   */
  hide(): void {
    this.activeRequests--;

    // Protección contra números negativos
    if (this.activeRequests < 0) {
      console.warn('⚠️ Loading counter went negative, resetting to 0');
      this.activeRequests = 0;
    }

    // Log detallado para debugging
    console.log(`📉 Loading.hide() called. Active requests: ${this.activeRequests}`);

    // Solo intentar ocultar si no hay más requests activos
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      this.hideSubject.next();
    }
  }

  /**
   * Forzar ocultar loading (para casos de emergencia - MEJORADO)
   */
  forceHide(): void {
    console.warn('🚨 Loading.forceHide() called - Emergency cleanup');

    this.activeRequests = 0;

    // Limpiar timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Forzar cambio inmediato
    this.isProcessingChange = false;
    this.safeEmitLoadingState(false);
  }

  /**
   * Obtener estado actual de loading (síncrono)
   */
  get isLoading(): boolean {
    return this.currentLoadingState;
  }

  /**
   * Obtener número de requests activos (para debugging)
   */
  get activeRequestsCount(): number {
    return this.activeRequests;
  }

  /**
   * Reset completo del servicio (útil para testing - MEJORADO)
   */
  reset(): void {
    console.log('🔄 LoadingService.reset() called');

    // Limpiar timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Reset completo
    this.activeRequests = 0;
    this.currentLoadingState = false;
    this.isProcessingChange = false;

    // Emitir estado final
    this.loadingSubject.next(false);
  }

  /**
   * NUEVO: Método para operaciones críticas que no deben fallar
   */
  safeOperation<T>(operation: () => T): T {
    try {
      this.show();
      const result = operation();

      // Si es una Promise, manejar hide en then/catch
      if (result instanceof Promise) {
        (result as any)
          .then(() => this.hide())
          .catch(() => this.hide());
      } else {
        // Operación síncrona
        setTimeout(() => this.hide(), 0);
      }

      return result;
    } catch (error) {
      this.hide();
      throw error;
    }
  }

  /**
   * NUEVO: Método para debugging - obtener estado completo
   */
  getDebugInfo(): {
    isLoading: boolean;
    activeRequests: number;
    isProcessing: boolean;
    hasCleanupTimer: boolean;
  } {
    return {
      isLoading: this.currentLoadingState,
      activeRequests: this.activeRequests,
      isProcessing: this.isProcessingChange,
      hasCleanupTimer: !!this.cleanupTimer
    };
  }
}
