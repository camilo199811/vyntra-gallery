import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export type ClientType = 'event' | 'brand';
export interface UpdateClientDto {
  full_name: string;
  email: string | null;
  phone: string | null;
  client_type: ClientType;
}
export interface VyntraClient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  client_type: ClientType;
  auth_user_id: string | null;
  created_at: string;
}
export interface CreateClientDto {
  full_name: string;
  email: string | null;
  phone: string | null;
  client_type: ClientType;
}
@Injectable({
  providedIn: 'root'
})
export class ClientsService {
  private supabase = inject(SupabaseService);
async createClient(
  client: CreateClientDto
): Promise<VyntraClient> {

  const { data, error } = await this.supabase.client
    .from('clients')
    .insert(client)
    .select(
      'id, full_name, email, phone, client_type, auth_user_id, created_at'
    )
    .single();

  if (error) throw error;

  return data as VyntraClient;
}
async getClientById(
  id: string
): Promise<VyntraClient | null> {

  const { data, error } = await this.supabase.client
    .from('clients')
    .select(
      'id, full_name, email, phone, client_type, auth_user_id, created_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  return data as VyntraClient | null;
}
async updateClient(
  id: string,
  client: UpdateClientDto
): Promise<void> {

  const { error } = await this.supabase.client.rpc(
    'update_client_details',
    {
      p_client_id: id,
      p_full_name: client.full_name,
      p_email: client.email,
      p_phone: client.phone,
      p_client_type: client.client_type
    }
  );

  if (error) throw error;
}
  async getClients(): Promise<VyntraClient[]> {
    const { data, error } = await this.supabase.client
      .from('clients')
      .select(
        'id, full_name, email, phone, client_type, auth_user_id, created_at'
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as VyntraClient[];
  }
}