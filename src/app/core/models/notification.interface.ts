export interface NotificationOptions {
  duration?: number;
  persistent?: boolean;
  showCloseButton?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
  defaultDuration?: number;
  enableSounds?: boolean;
  enableAnimations?: boolean;
}
