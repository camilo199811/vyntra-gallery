
import { Component, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { SupabaseService } from '../../core/services/supabase';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayout {

  private router = inject(Router);
  private supabase = inject(SupabaseService);

  menuOpen = signal(false);
  loggingOut = signal(false);
  logoutError = signal('');

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update(value => !value);
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;

    this.loggingOut.set(true);
    this.logoutError.set('');

    try {
      const { error } =
        await this.supabase.client.auth.signOut();

      if (error) throw error;

      this.closeMenu();
      await this.router.navigateByUrl('/login', {
        replaceUrl: true
      });

    } catch (error) {
      console.error('Error cerrando sesión:', error);

      this.logoutError.set(
        'No fue posible cerrar la sesión. Inténtalo nuevamente.'
      );

    } finally {
      this.loggingOut.set(false);
    }
  }
}
