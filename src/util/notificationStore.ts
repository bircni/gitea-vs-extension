import type { NotificationThread } from "../gitea/models";

export class NotificationStore {
  private notifications: NotificationThread[] = [];
  private loading = false;
  private error?: string;

  setLoading(isLoading: boolean): void {
    this.loading = isLoading;
  }

  setError(message?: string): void {
    this.error = message;
  }

  setNotifications(list: NotificationThread[]): void {
    this.notifications = list;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getError(): string | undefined {
    return this.error;
  }

  getNotifications(): NotificationThread[] {
    return this.notifications;
  }
}
