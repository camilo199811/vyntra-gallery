import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  parsePhoneNumberFromString,
  getExampleNumber,
  getCountryCallingCode,
  validatePhoneNumberLength,
  type CountryCode
} from 'libphonenumber-js/max';

import examples from 'libphonenumber-js/examples.mobile.json';
import { RouterLink } from '@angular/router';
import { COUNTRIES } from '../../../core/constants/countries';
import { CreateClientDto } from '../../../core/services/clients';
import {
  ClientsService,
  VyntraClient,
  ClientType
} from '../../../core/services/clients';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [ReactiveFormsModule,RouterLink],
  templateUrl: './clients.html',
  styleUrl: './clients.scss'
})
export class Clients implements OnInit {
  private clientsService = inject(ClientsService);

  clients = signal<VyntraClient[]>([]);
  selectedType = signal<'all' | ClientType>('all');
  loading = signal(true);
  errorMessage = signal('');
private fb = inject(FormBuilder);

showCreateForm = signal(false);
saving = signal(false);
successMessage = signal('');

clientForm = this.fb.nonNullable.group({
  full_name: ['', [
    Validators.required,
    Validators.minLength(3)
  ]],
  email: ['', Validators.email],
  phone: [''],
  client_type: this.fb.nonNullable.control<ClientType>(
    'event',
    Validators.required
  )
});
countries = COUNTRIES;

phoneError = signal('');
phoneExample = signal('300 123 4567');

selectedCountry = signal<CountryCode>('CO');

changeCountry(code: string) {
  const country = code as CountryCode;

  this.selectedCountry.set(country);
  this.clientForm.controls.phone.setValue('');
  this.phoneError.set('');

  const example = getExampleNumber(
    country,
    examples
  );

  this.phoneExample.set(
    example?.formatNational() ?? 'Número de teléfono'
  );
}

validatePhone(): boolean {
  const rawPhone =
    this.clientForm.controls.phone.value.trim();

  if (!rawPhone) {
    this.phoneError.set('');
    return true;
  }

  const phone = parsePhoneNumberFromString(
    rawPhone,
    this.selectedCountry()
  );

  if (
    !phone ||
    phone.country !== this.selectedCountry() ||
    !phone.isValid()
  ) {
    this.phoneError.set(
      'Ingresa un número válido para el país seleccionado.'
    );
    return false;
  }

  this.phoneError.set('');
  return true;
}
openCreateForm() {
  this.clientForm.reset({
    full_name: '',
    email: '',
    phone: '',
    client_type: 'event'
  });
this.changeCountry('CO');
  this.errorMessage.set('');
  this.successMessage.set('');
  this.showCreateForm.set(true);
}

closeCreateForm() {
  if (this.saving()) return;

  this.showCreateForm.set(false);
}

async saveClient() {
  if (this.clientForm.invalid || this.saving()) {
    this.clientForm.markAllAsTouched();
    return;
  }
if (!this.validatePhone()) {
  return;
}
  this.saving.set(true);
  this.errorMessage.set('');
  this.successMessage.set('');

  try {
    const values = this.clientForm.getRawValue();

    const newClient: CreateClientDto = {
      full_name: values.full_name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim()
  ? parsePhoneNumberFromString(
      values.phone.trim(),
      this.selectedCountry()
    )!.number
  : null,
      client_type: values.client_type
    };

    if (newClient.full_name.length < 3) {
      this.errorMessage.set(
        'El nombre debe tener al menos 3 caracteres.'
      );
      return;
    }

    await this.clientsService.createClient(newClient);

    this.showCreateForm.set(false);
    this.successMessage.set(
      'Cliente registrado correctamente.'
    );

    await this.loadClients();

  } catch (error) {
    console.error('Error creando cliente:', error);

    this.errorMessage.set(
      'No fue posible registrar el cliente. Verifica los permisos.'
    );
  } finally {
    this.saving.set(false);
  }
}
  get filteredClients(): VyntraClient[] {
    const type = this.selectedType();

    return this.clients().filter(client =>
      type === 'all' || client.client_type === type
    );
  }

  async ngOnInit() {
    await this.loadClients();
  }

  async loadClients() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const data = await this.clientsService.getClients();
      this.clients.set(data);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      this.errorMessage.set(
        'No fue posible cargar los clientes.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(type: 'all' | ClientType) {
    this.selectedType.set(type);
  }
}