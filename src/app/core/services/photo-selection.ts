
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

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
export class PhotoSelectionService {

  private supabase = inject(SupabaseService);

  // Consultar las selecciones guardadas de un álbum.
  async getSelections(
    albumId: string
  ): Promise<PhotoSelection[]> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []) as PhotoSelection[];
  }

  // Consultar únicamente las fotografías seleccionadas.
  async getSelectedPhotoIds(
    albumId: string
  ): Promise<string[]> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .select('photo_id')
      .eq('album_id', albumId)
      .eq('selected', true);

    if (error) throw error;

    return (data ?? []).map(item => item.photo_id);
  }

  // Guardar o modificar la selección de una fotografía.
  async setPhotoSelection(
    albumId: string,
    photoId: string,
    selected: boolean
  ): Promise<PhotoSelection> {

    const { data, error } = await this.supabase.client
      .from('photo_selections')
      .upsert(
        {
          album_id: albumId,
          photo_id: photoId,
          selected,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'album_id,photo_id'
        }
      )
      .select('*')
      .single();

    if (error) throw error;

    return data as PhotoSelection;
  }

  // Contar las fotografías seleccionadas.
  async countSelectedPhotos(
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
}
