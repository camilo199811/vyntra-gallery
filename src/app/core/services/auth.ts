
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'client';

interface ClientLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private supabase = inject(SupabaseService);
  private router = inject(Router);

  async signIn(
    identifier: string,
    password: string
  ): Promise<UserRole> {

    const normalizedIdentifier =
      identifier.trim().toLowerCase();

    if (!normalizedIdentifier || !password) {
      throw new Error(
        'Debes ingresar tus credenciales.'
      );
    }

    // Cerrar una sesión anterior antes de autenticar.
    const { error: signOutError } =
      await this.supabase.client.auth.signOut();

    if (signOutError) {
      throw signOutError;
    }

    if (normalizedIdentifier.includes('@')) {

      // Administradores: correo y contraseña.
      const { data, error } =
        await this.supabase.client.auth.signInWithPassword({
          email: normalizedIdentifier,
          password
        });

      if (error) throw error;

      if (!data.user) {
        throw new Error('No se pudo obtener el usuario.');
      }

      const role = await this.getUserRole(data.user.id);

      if (role !== 'super_admin' && role !== 'admin') {
        await this.signOut(false);
        throw new Error('Acceso no autorizado.');
      }

      return role;
    }

    // Clientes: nombre de usuario y contraseña.
    const { data, error } =
      await this.supabase.client.functions.invoke<ClientLoginResponse>(
        'login-client',
        {
          body: {
            username: normalizedIdentifier,
            password
          }
        }
      );

    if (error || !data?.access_token || !data?.refresh_token) {
      throw new Error('Credenciales incorrectas.');
    }

    // Guardar la sesión real en Supabase Auth.
    const { data: sessionData, error: sessionError } =
      await this.supabase.client.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

    if (sessionError || !sessionData.user) {
      throw new Error('No fue posible establecer la sesión.');
    }

    const role = await this.getUserRole(sessionData.user.id);

    if (role !== 'client') {
      await this.signOut(false);
      throw new Error('Acceso no autorizado.');
    }

    return role;
  }

  async getUserRole(
    userId: string
  ): Promise<UserRole | null> {

    const { data, error } =
      await this.supabase.client
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;

    const role = data?.role;

    if (
      role === 'super_admin' ||
      role === 'admin' ||
      role === 'client'
    ) {
      return role;
    }

    return null;
  }

  async getCurrentRole(): Promise<UserRole | null> {

    const { data, error } =
      await this.supabase.client.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return this.getUserRole(data.user.id);
  }

  async signOut(redirect = true) {

    const { error } =
      await this.supabase.client.auth.signOut();

    if (error) throw error;

    if (redirect) {
      await this.router.navigateByUrl('/login');
    }
  }
}
