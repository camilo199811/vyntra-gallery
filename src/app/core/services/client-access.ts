
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface CreateClientAccessDto {
  clientId: string;
  username: string;
  password: string;
}

export interface CreateClientAccessResponse {
  success: boolean;
  message?: string;
  username?: string;
  authUserId?: string;
  error?: string;
}

export interface ResetClientPasswordDto {
  clientId: string;
  newPassword: string;
}

export interface ResetClientPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClientAccessService {

  private supabaseService = inject(SupabaseService);

  // ==========================================
  // EXTRAER ERRORES DE EDGE FUNCTIONS
  // ==========================================

  private async getFunctionError(
    error: unknown
  ): Promise<string> {

    const functionError = error as {
      message?: string;
      context?: Response;
    };

    let message =
      functionError.message || 'Error desconocido.';

    if (functionError.context) {
      try {
        const body =
          await functionError.context.json();

        message =
          body.error ||
          body.message ||
          message;

      } catch {
        // Mantener el mensaje original.
      }
    }

    return message;
  }

  // ==========================================
  // CREAR ACCESO PRIVADO
  // ==========================================

  async createAccess(
    data: CreateClientAccessDto
  ): Promise<CreateClientAccessResponse> {

    const { data: result, error } =
      await this.supabaseService.client.functions.invoke(
        'create-client-access',
        {
          body: data
        }
      );

    if (error) {
      throw new Error(
        await this.getFunctionError(error)
      );
    }

    if (!result?.success) {
      throw new Error(
        result?.error ||
        'No fue posible crear el acceso.'
      );
    }

    return result as CreateClientAccessResponse;
  }

  // ==========================================
  // RESTABLECER CONTRASEÑA DE CLIENTE
  // ==========================================

  async resetClientPassword(
    data: ResetClientPasswordDto
  ): Promise<ResetClientPasswordResponse> {

    const { data: result, error } =
      await this.supabaseService.client.functions.invoke(
        'reset-client-password',
        {
          body: data
        }
      );

    if (error) {
      throw new Error(
        await this.getFunctionError(error)
      );
    }

    if (!result?.success) {
      throw new Error(
        result?.error ||
        'No fue posible restablecer la contraseña.'
      );
    }

    return result as ResetClientPasswordResponse;
  }
}
