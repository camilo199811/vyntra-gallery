
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { SupabaseService } from '../../../core/services/supabase';

import {
  parsePhoneNumberFromString,
  getExampleNumber,
  type CountryCode
} from 'libphonenumber-js/max';

import examples from 'libphonenumber-js/examples.mobile.json';

import { COUNTRIES } from '../../../core/constants/countries';

import {
  ClientType,
  UpdateClientDto,
  ClientsService,
  VyntraClient
} from '../../../core/services/clients';

import {
  ClientAccessService
} from '../../../core/services/client-access';

interface ClientAlbumCard {
  id: string;
  title: string;
  event_type: string;
  event_date: string | null;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss'
})
export class ClientDetail implements OnInit {

private supabase = inject(SupabaseService);

clientAlbums = signal<ClientAlbumCard[]>([]);
albumsLoading = signal(false);
albumsError = signal('');

accessUsername = signal<string | null>(null);
usernameLoading = signal(false);
usernameError = signal('');

  private route = inject(ActivatedRoute);
  private clientsService = inject(ClientsService);
  private clientAccessService = inject(ClientAccessService);
  private fb = inject(FormBuilder);

  // ESTADO GENERAL

  client = signal<VyntraClient | null>(null);
  loading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');

  countries = COUNTRIES;

  // ACCESO PRIVADO

  creatingAccess = signal(false);
  savingAccess = signal(false);
  accessError = signal('');

async loadClientAlbums(clientId: string): Promise<void> {
  this.albumsLoading.set(true);
  this.albumsError.set('');

  try {
    const { data, error } = await this.supabase.client
      .from('albums')
      .select(
        'id, title, event_type, event_date, status, created_at'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    this.clientAlbums.set(
      (data ?? []) as ClientAlbumCard[]
    );

  } catch (error) {
    console.error('Error cargando álbumes:', error);

    this.albumsError.set(
      'No fue posible consultar los álbumes asociados.'
    );

  } finally {
    this.albumsLoading.set(false);
  }
}


async loadAccessUsername(
  authUserId: string | null
): Promise<void> {

  this.accessUsername.set(null);
  this.usernameError.set('');

  if (!authUserId) return;

  this.usernameLoading.set(true);

  try {

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('username')
      .eq('id', authUserId)
      .maybeSingle();

    if (error) {
      console.error(
        'VYNTRA - Error consultando usuario:',
        error
      );
      throw error;
    }

    console.log(
      'VYNTRA - Usuario encontrado:',
      data?.username
    );

    this.accessUsername.set(
      data?.username ?? null
    );

  } catch (error) {

    console.error(
      'Error cargando nombre de usuario:',
      error
    );

    this.usernameError.set(
      'No fue posible consultar el usuario.'
    );

  } finally {
    this.usernameLoading.set(false);
  }
}


  accessForm = this.fb.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(4),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/)
      ]
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(12)
      ]
    ]
  });

  openAccessForm() {
    const current = this.client();

    if (!current || current.auth_user_id) {
      return;
    }

    this.accessForm.reset({
      username: '',
      password: ''
    });

    this.accessError.set('');
    this.successMessage.set('');
    this.creatingAccess.set(true);
  }

  closeAccessForm() {
    if (this.savingAccess()) return;

    this.creatingAccess.set(false);
    this.accessError.set('');
    this.accessForm.reset();
  }

  async createAccess() {
    if (this.savingAccess()) return;

    if (this.accessForm.invalid) {
      this.accessForm.markAllAsTouched();
      return;
    }

    const current = this.client();

    if (!current || current.auth_user_id) {
      this.accessError.set(
        'Este cliente no está disponible para crear acceso.'
      );
      return;
    }

    this.savingAccess.set(true);
    this.accessError.set('');

    try {
      const values = this.accessForm.getRawValue();

      await this.clientAccessService.createAccess({
        clientId: current.id,
        username: values.username.trim(),
        password: values.password
      });

      const refreshed =
        await this.clientsService.getClientById(current.id);

      if (!refreshed) {
        throw new Error(
          'No se pudo consultar el cliente actualizado.'
        );
      }

      this.client.set(refreshed);
await this.loadAccessUsername(refreshed.auth_user_id);
      this.creatingAccess.set(false);
      this.accessForm.reset();

      this.successMessage.set(
        refreshed.auth_user_id
          ? 'Acceso privado creado correctamente.'
          : 'La función respondió correctamente, pero todavía no se confirmó la vinculación del cliente. Verifica Supabase.'
      );

    } catch (error) {
      console.error('Error creando acceso:', error);

      this.accessError.set(
        error instanceof Error
          ? error.message
          : 'No fue posible crear el acceso.'
      );

    } finally {
      this.savingAccess.set(false);
    }
  }

  // EDICIÓN DEL CLIENTE

  editing = signal(false);
  saving = signal(false);
  saveError = signal('');

  selectedCountry = signal<CountryCode>('CO');
  phoneExample = signal('300 123 4567');
  phoneError = signal('');

  // ==========================================
  // RESTABLECER CONTRASEÑA DEL CLIENTE
  // ==========================================

  resettingPassword = signal(false);
  savingNewPassword = signal(false);
  resetPasswordError = signal('');
  resetPasswordSuccess = signal('');

  showNewPassword = signal(false);

  resetPasswordForm = this.fb.nonNullable.group({
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(12)
      ]
    ],
    confirmPassword: [
      '',
      [
        Validators.required
      ]
    ]
  });

  openResetPasswordForm(): void {
    const current = this.client();

    if (!current?.auth_user_id) return;

    this.resetPasswordForm.reset({
      newPassword: '',
      confirmPassword: ''
    });

    this.resetPasswordError.set('');
    this.resetPasswordSuccess.set('');
    this.showNewPassword.set(false);
    this.resettingPassword.set(true);
  }

  closeResetPasswordForm(): void {
    if (this.savingNewPassword()) return;

    this.resettingPassword.set(false);
    this.resetPasswordError.set('');
    this.resetPasswordForm.reset();
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update(value => !value);
  }

  async saveNewPassword(): Promise<void> {
    if (this.savingNewPassword()) return;

    const current = this.client();

    if (!current?.auth_user_id) {
      this.resetPasswordError.set(
        'El cliente no tiene una cuenta vinculada.'
      );
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const values = this.resetPasswordForm.getRawValue();

    if (values.newPassword !== values.confirmPassword) {
      this.resetPasswordError.set(
        'Las contraseñas no coinciden.'
      );
      return;
    }

    this.savingNewPassword.set(true);
    this.resetPasswordError.set('');
    this.resetPasswordSuccess.set('');

    try {
      await this.clientAccessService.resetClientPassword({
        clientId: current.id,
        newPassword: values.newPassword
      });

      this.resettingPassword.set(false);
      this.resetPasswordForm.reset();

      this.resetPasswordSuccess.set(
        'Contraseña actualizada correctamente. ' +
        'Ya puedes compartir la nueva contraseña con el cliente.'
      );

    } catch (error) {
      console.error(
        'Error restableciendo contraseña:',
        error
      );

      this.resetPasswordError.set(
        error instanceof Error
          ? error.message
          : 'No fue posible actualizar la contraseña.'
      );

    } finally {
      this.savingNewPassword.set(false);
    }
  }

  editForm = this.fb.nonNullable.group({
    full_name: [
      '',
      [
        Validators.required,
        Validators.minLength(3)
      ]
    ],
    email: ['', Validators.email],
    phone: [''],
    client_type: this.fb.nonNullable.control<ClientType>(
      'event',
      Validators.required
    )
  });

  openEditForm() {
    const current = this.client();

    if (!current) return;

    let country: CountryCode = 'CO';
    let nationalPhone = current.phone ?? '';

    if (current.phone) {
      const parsed = parsePhoneNumberFromString(
        current.phone
      );

      if (parsed) {
        country = parsed.country ?? 'CO';
        nationalPhone = parsed.nationalNumber;
      }
    }

    this.selectedCountry.set(country);
    this.updatePhoneExample(country);

    this.editForm.reset({
      full_name: current.full_name ?? '',
      email: current.email ?? '',
      phone: nationalPhone,
      client_type: current.client_type ?? 'event'
    });

    this.phoneError.set('');
    this.saveError.set('');
    this.successMessage.set('');

    this.editing.set(true);
  }

  closeEditForm() {
    if (this.saving()) return;

    this.editing.set(false);
  }

  updatePhoneExample(country: CountryCode) {
    const example = getExampleNumber(
      country,
      examples
    );

    this.phoneExample.set(
      example?.formatNational() ?? 'Número de teléfono'
    );
  }

  changeCountry(code: string) {
    const country = code as CountryCode;

    this.selectedCountry.set(country);
    this.editForm.controls.phone.setValue('');
    this.phoneError.set('');
    this.updatePhoneExample(country);
  }

  validatePhone(): boolean {
    const value =
      this.editForm.controls.phone.value.trim();

    if (!value) {
      this.phoneError.set('');
      return true;
    }

    const parsed = parsePhoneNumberFromString(
      value,
      this.selectedCountry()
    );

    if (
      !parsed ||
      parsed.country !== this.selectedCountry() ||
      !parsed.isValid()
    ) {
      this.phoneError.set(
        'Ingresa un número válido para el país seleccionado.'
      );
      return false;
    }

    this.phoneError.set('');
    return true;
  }

  async saveChanges() {
    if (this.saving()) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    if (!this.validatePhone()) return;

    const current = this.client();
    if (!current) return;

    this.saving.set(true);
    this.saveError.set('');

    try {
      const values = this.editForm.getRawValue();

      const parsedPhone = values.phone.trim()
        ? parsePhoneNumberFromString(
            values.phone.trim(),
            this.selectedCountry()
          )
        : null;

      const updated: UpdateClientDto = {
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase() || null,
        phone: parsedPhone?.number ?? null,
        client_type: values.client_type
      };

      await this.clientsService.updateClient(
        current.id,
        updated
      );

      const refreshed =
        await this.clientsService.getClientById(current.id);

      if (!refreshed) {
        throw new Error(
          'No se encontró el cliente actualizado.'
        );
      }

      this.client.set(refreshed);
      this.editing.set(false);

      this.successMessage.set(
        'Información actualizada correctamente.'
      );

    } catch (error) {
      console.error('Error actualizando cliente:', error);

      this.saveError.set(
        'No fue posible guardar los cambios.'
      );

    } finally {
      this.saving.set(false);
    }
  }

  // CARGA INICIAL

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.errorMessage.set(
        'No se encontró el identificador.'
      );
      this.loading.set(false);
      return;
    }

    try {
      const result =
        await this.clientsService.getClientById(id);

      if (!result) {
        this.errorMessage.set(
          'Cliente no encontrado.'
        );
        return;
      }

      this.client.set(result);

await Promise.all([
  this.loadClientAlbums(result.id),
  this.loadAccessUsername(result.auth_user_id)
]);

    } catch (error) {
      console.error('Error cargando cliente:', error);

      this.errorMessage.set(
        'No fue posible cargar la información del cliente.'
      );

    } finally {
      this.loading.set(false);
    }
  }
}
