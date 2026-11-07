
import {
  Component,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth';
import { SupabaseService } from '../../../core/services/supabase';
import { AlbumsService } from '../../../core/services/album';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private albumsService = inject(AlbumsService);

  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    identifier: [
      '',
      [
        Validators.required,
        Validators.minLength(4)
      ]
    ],
    password: [
      '',
      Validators.required
    ]
  });

  async login(): Promise<void> {

    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {

      const { identifier, password } =
        this.form.getRawValue();

      const role = await this.auth.signIn(
        identifier,
        password
      );

      // ======================================
      // ADMINISTRADORES
      // ======================================

      if (
        role === 'super_admin' ||
        role === 'admin'
      ) {

        await this.router.navigateByUrl(
          '/admin/dashboard'
        );

        return;
      }

      // ======================================
      // CLIENTES
      // ======================================

      if (role === 'client') {

        const { data: userData, error: userError } =
          await this.supabase.client.auth.getUser();

        if (userError || !userData.user) {
          throw new Error(
            'No fue posible identificar al cliente.'
          );
        }

        const { data: access, error: accessError } =
          await this.supabase.client
            .from('client_access')
            .select('client_id')
            .eq('auth_user_id', userData.user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (accessError) throw accessError;

        if (!access) {
          this.errorMessage.set(
            'Tu cuenta no tiene un acceso activo. Comunícate con Vyntra.'
          );
          return;
        }

        const albums =
          await this.albumsService.getAlbumsByClient(
            access.client_id
          );

        const publishedAlbums = albums.filter(
          album => album.status === 'published'
        );

        if (publishedAlbums.length === 0) {
          this.errorMessage.set(
            'Todavía no tienes álbumes publicados.'
          );
          return;
        }

        const firstAlbum = publishedAlbums[0];

        await this.router.navigate(
          ['/gallery', firstAlbum.id, 'album']
        );

        return;
      }

      throw new Error(
        'No se reconoció el tipo de usuario.'
      );

    

} catch (error: unknown) {

  console.error(
    'VYNTRA - Error completo:',
    error
  );

  const details =
    error !== null && typeof error === 'object'
      ? error as Record<string, unknown>
      : {};

  const message = [
    details['message'],
    details['code'],
    details['details'],
    details['hint']
  ]
    .filter(value => value !== null && value !== undefined)
    .map(value => String(value))
    .join(' | ');

  this.errorMessage.set(
    'Error al acceder: ' +
    (message || (
      error instanceof Error
        ? error.message
        : 'Error desconocido. Revisa la consola.'
    ))
  );

}

 finally {

      this.loading.set(false);

    }
  }
}
