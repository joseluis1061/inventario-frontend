import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, timer } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);

  // Observable para componentes que necesiten suscribirse
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  // Configuración por defecto
  private defaultDuration = 5000; // 5 segundos
  private maxNotifications = 5;

  /**
   * Obtener todas las notificaciones actuales
   */
  getNotifications() {
    return this.notifications();
  }

  /**
   * Mostrar notificación de éxito
   */
  success(message: string, title?: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'success',
      message,
      title: title || 'Éxito',
      ...options
    });
  }

  /**
   * Mostrar notificación de error
   */
  error(message: string, title?: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'error',
      message,
      title: title || 'Error',
      persistent: true, // Los errores son persistentes por defecto
      ...options
    });
  }

  /**
   * Mostrar notificación de advertencia
   */
  warning(message: string, title?: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'warning',
      message,
      title: title || 'Advertencia',
      duration: 7000, // Advertencias duran más
      ...options
    });
  }

  /**
   * Mostrar notificación informativa
   */
  info(message: string, title?: string, options?: Partial<Notification>): string {
    return this.addNotification({
      type: 'info',
      message,
      title: title || 'Información',
      ...options
    });
  }

  /**
   * Agregar notificación personalizada
   */
  addNotification(notificationData: Partial<Notification>): string {
    const notification: Notification = {
      id: this.generateId(),
      type: 'info',
      message: '',
      duration: this.defaultDuration,
      persistent: false,
      timestamp: new Date(),
      ...notificationData
    };

    // Obtener notificaciones actuales
    const currentNotifications = this.notifications();

    // Limitar número máximo de notificaciones
    const updatedNotifications = [
      notification,
      ...currentNotifications.slice(0, this.maxNotifications - 1)
    ];

    // Actualizar estado
    this.notifications.set(updatedNotifications);
    this.notificationsSubject.next(updatedNotifications);

    // Auto-remover si no es persistente
    if (!notification.persistent && notification.duration && notification.duration > 0) {
      timer(notification.duration).subscribe(() => {
        this.removeNotification(notification.id);
      });
    }

    console.log(`📢 Notification [${notification.type.toUpperCase()}]: ${notification.message}`);

    return notification.id;
  }

  /**
   * Remover notificación específica
   */
  removeNotification(id: string): void {
    const currentNotifications = this.notifications();
    const filteredNotifications = currentNotifications.filter(n => n.id !== id);

    this.notifications.set(filteredNotifications);
    this.notificationsSubject.next(filteredNotifications);
  }

  /**
   * Remover todas las notificaciones
   */
  clearAll(): void {
    this.notifications.set([]);
    this.notificationsSubject.next([]);
  }

  /**
   * Remover notificaciones por tipo
   */
  clearByType(type: Notification['type']): void {
    const currentNotifications = this.notifications();
    const filteredNotifications = currentNotifications.filter(n => n.type !== type);

    this.notifications.set(filteredNotifications);
    this.notificationsSubject.next(filteredNotifications);
  }

  /**
   * Verificar si existe una notificación con el mismo mensaje
   */
  private isDuplicate(message: string): boolean {
    return this.notifications().some(n => n.message === message);
  }

  /**
   * Mostrar notificación solo si no es duplicada
   */
  showUnique(type: Notification['type'], message: string, title?: string): string | null {
    if (this.isDuplicate(message)) {
      return null;
    }

    switch (type) {
      case 'success':
        return this.success(message, title);
      case 'error':
        return this.error(message, title);
      case 'warning':
        return this.warning(message, title);
      case 'info':
        return this.info(message, title);
      default:
        return this.info(message, title);
    }
  }

  /**
   * Métodos de conveniencia para casos comunes
   */
  loginSuccess(username: string): string {
    return this.success(`Bienvenido, ${username}`, 'Login Exitoso');
  }

  loginError(message?: string): string {
    return this.error(message || 'Credenciales incorrectas', 'Error de Login');
  }

  logoutSuccess(): string {
    return this.info('Sesión cerrada correctamente', 'Hasta luego');
  }

  sessionExpired(): string {
    return this.warning('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'Sesión Expirada');
  }

  networkError(): string {
    return this.error('Error de conexión. Verifica tu internet.', 'Sin Conexión');
  }

  operationSuccess(operation: string): string {
    return this.success(`${operation} realizada correctamente`);
  }

  operationError(operation: string, error?: string): string {
    return this.error(error || `Error al realizar ${operation}`, 'Error de Operación');
  }

  validationError(field: string): string {
    return this.warning(`El campo ${field} es requerido o tiene un formato inválido`, 'Datos Inválidos');
  }

  permissionDenied(): string {
    return this.error('No tienes permisos para realizar esta acción', 'Acceso Denegado');
  }

  /**
   * Configurar duración por defecto
   */
  setDefaultDuration(duration: number): void {
    this.defaultDuration = duration;
  }

  /**
   * Configurar máximo de notificaciones
   */
  setMaxNotifications(max: number): void {
    this.maxNotifications = max;
  }

  /**
   * Generar ID único para notificación
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  getStats() {
    const notifications = this.notifications();
    return {
      total: notifications.length,
      byType: {
        success: notifications.filter(n => n.type === 'success').length,
        error: notifications.filter(n => n.type === 'error').length,
        warning: notifications.filter(n => n.type === 'warning').length,
        info: notifications.filter(n => n.type === 'info').length
      },
      persistent: notifications.filter(n => n.persistent).length,
      temporary: notifications.filter(n => !n.persistent).length
    };
  }
}
