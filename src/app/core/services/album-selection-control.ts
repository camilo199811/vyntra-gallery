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

@Injectable({
  providedIn: 'root'
})
export class AlbumSelectionControlService {

  private supabase = inject(SupabaseService);

  async getControl(
    albumId: string
  ): Promise<AlbumSelectionControl | null> {

    const { data, error } =
      await this.supabase.client
        .from('album_selection_control')
        .select('*')
        .eq('album_id', albumId)
        .maybeSingle();

    if (error) throw error;

    return data as AlbumSelectionControl | null;
  }

  async reopenSelection(
    albumId: string
  ): Promise<void> {

    const { data, error } =
      await this.supabase.client.rpc(
        'reopen_album_selection',
        {
          p_album_id: albumId
        }
      );

    if (error) throw error;

    if (data !== true) {
      throw new Error(
        'No se pudo autorizar la reapertura.'
      );
    }
  }
}