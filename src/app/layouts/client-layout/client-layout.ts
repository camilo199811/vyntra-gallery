
import {
  Component,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';

import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { filter, Subscription } from 'rxjs';

import {
  SupabaseService
} from '../../core/services/supabase';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './client-layout.html',
  styleUrl: './client-layout.scss'
})
export class ClientLayout implements OnDestroy {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  private navigationSubscription: Subscription;

  menuOpen = signal(false);
  albumId = signal('');
  isAdminPreview = signal(false);

  loggingOut = signal(false);
  logoutError = signal('');

  galleryUrl = computed(() => {
    const base = this.isAdminPreview()
      ? '/admin-preview'
      : '/gallery';

    return `${base}/${this.albumId()}`;
  });

  adminAlbumUrl = computed(() =>
    `/admin/albums/${this.albumId()}`
  );

  constructor() {
    this.updateRouteContext();

    this.navigationSubscription = this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd
        )
      )
      .subscribe(() => {
        this.updateRouteContext();
        this.closeMenu();
      });
  }

  private updateRouteContext(): void {
    const path = this.router.url.split('?')[0];

    this.isAdminPreview.set(
      path.startsWith('/admin-preview/')
    );

    const id =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('slug') ??
      '';

    this.albumId.set(id);
  }

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
        await this.supabase.client.auth.signOut({
          scope: 'local'
        });

      if (error) {
        throw error;
      }

      this.closeMenu();

      await this.router.navigateByUrl('/login', {
        replaceUrl: true
      });

    } catch (error) {
      console.error('Error cerrando sesión:', error);

      this.logoutError.set(
        'No fue posible cerrar sesión. Inténtalo nuevamente.'
      );

    } finally {
      this.loggingOut.set(false);
    }
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
  }
}
