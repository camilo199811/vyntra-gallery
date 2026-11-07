
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export type SelectionStatus = 'open' | 'closed';

export interface AlbumSelectionControl {
  album_id: string;
  selection_status: SelectionStatus;
  reopen_used: boolean;
  reopened_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface PhotoSelection {
  id: string;
  album_id: string;
  photo_id: string;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class SelectionService {

  private supabase = inject(SupabaseService);

  // =========================================
  // CONTROL DE SELECCIÓN
  // =========================================

  async getSelectionControl(
    albumId: string
  ): Promise<AlbumSelectionControl | null> {

    const { data, error } = await this.supabase.client
      .from('album_selection_control')
      .select('*')
      .eq('album_id', albumId)
      .maybeSingle();

    if (error) {
      console.error(
        'VYNTRA - Error consultando control:',
        error
      );
      throw error;
    }

    return data as AlbumSelectionControl | null;
  }

  // =========================================
  // CERRAR SELECCIÓN
  // =========================================

  async closeSelection(
    albumId: string
  ): Promise<AlbumSelectionControl> {

    const now = new Date().toISOString();

    const { data, error } = await this.supabase.client
      .from('album_selection_control')
      .update({
        selection_status: 'closed',
        closed_at: now,
        updated_at: now
      })
      .eq('album_id', albumId)
      .eq('selection_status', 'open')
      .select('*')
      .single();

    if (error) {
      console.error(
        'VYNTRA - Error cerrando selección:',
        error
      );
      throw error;
    }

    return data as AlbumSelectionControl;
  }

  // =========================================
  // REABRIR SELECCIÓN (UNA SOLA VEZ)
  // =========================================

  async reopenSelection(
    albumId: string
  ): Promise<AlbumSelectionControl> {

    console.log(
      'VYNTRA - Solicitando reapertura:',
      albumId
    );

    const { data, error } = await this.supabase.client
      .rpc('admin_reopen_selection', {
        target_album_id: albumId
      });

    if (error) {
      console.error(
        'VYNTRA - Error real de Supabase:',
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      );

      throw new Error(
        error.message ||
        'No fue posible autorizar la reapertura.'
      );
    }

    if (data !== true) {
      throw new Error(
        'Supabase no confirmó la reapertura.'
      );
    }

    const control =
      await this.getSelectionControl(albumId);

    if (!control) {
      throw new Error(
        'No se encontró el control de selección del álbum.'
      );
    }

    if (control.selection_status !== 'open') {
      throw new Error(
        'La reapertura se ejecutó, pero la selección continúa cerrada.'
      );
    }

    if (!control.reopen_used) {
      throw new Error(
        'La reapertura no quedó registrada correctamente.'
      );
    }

    console.log(
      'VYNTRA - Reapertura autorizada:',
      control
    );

    return control;
  }

  // =========================================
  // CONSULTAR FOTOGRAFÍAS FAVORITAS
  // =========================================

  async getPhotoSelections(
    albumId: string
  ): Promise<PhotoSelection[]> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .select('*')
      .eq('album_id', albumId)
      .eq('selected', true)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      console.error(
        'VYNTRA - Error consultando favoritos:',
        error
      );
      throw error;
    }

    return (data ?? []) as PhotoSelection[];
  }

  // =========================================
  // CONSULTAR UNA FOTOGRAFÍA
  // =========================================

  async isPhotoSelected(
    albumId: string,
    photoId: string
  ): Promise<boolean> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .select('selected')
      .eq('album_id', albumId)
      .eq('photo_id', photoId)
      .maybeSingle();

    if (error) throw error;

    return data?.selected === true;
  }

  // =========================================
  // MARCAR FOTOGRAFÍA COMO FAVORITA
  // =========================================

  async selectPhoto(
    albumId: string,
    photoId: string
  ): Promise<PhotoSelection> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .upsert(
        {
          album_id: albumId,
          photo_id: photoId,
          selected: true,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'album_id,photo_id'
        }
      )
      .select('*')
      .single();

    if (error) {
      console.error(
        'VYNTRA - Error seleccionando fotografía:',
        error
      );
      throw error;
    }

    return data as PhotoSelection;
  }

  // =========================================
  // QUITAR FOTOGRAFÍA DE FAVORITOS
  // =========================================

  async unselectPhoto(
    albumId: string,
    photoId: string
  ): Promise<void> {

    const { error } = await this.supabase.client
      .from('photo_selections')
      .update({
        selected: false,
        updated_at: new Date().toISOString()
      })
      .eq('album_id', albumId)
      .eq('photo_id', photoId);

    if (error) {
      console.error(
        'VYNTRA - Error quitando favorito:',
        error
      );
      throw error;
    }
  }

  // =========================================
  // CONTAR FOTOGRAFÍAS SELECCIONADAS
  // =========================================

  async getSelectedPhotoCount(
    albumId: string
  ): Promise<number> {

    const { count, error } = await this.supabase.client
      .from('photo_selections')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('album_id', albumId)
      .eq('selected', true);

    if (error) throw error;

    return count ?? 0;
  }

  // =========================================
  // CONFIRMAR SELECCIÓN OFICIAL
  // =========================================

  async confirmSelection(
    albumId: string
  ): Promise<void> {

    const { data, error } = await this.supabase.client
      .rpc('confirm_client_selection', {
        target_album_id: albumId
      });

    if (error) {
      console.error(
        'VYNTRA - Error confirmando selección:',
        error
      );
      throw error;
    }

    if (data !== true) {
      throw new Error(
        'No fue posible confirmar la selección.'
      );
    }
  }
}
