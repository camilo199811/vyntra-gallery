import {
  getCountries,
  getCountryCallingCode,
  type CountryCode
} from 'libphonenumber-js/max';

const displayNames = new Intl.DisplayNames(['es'], {
  type: 'region'
});

export const COUNTRIES = getCountries()
  .map((code: CountryCode) => ({
    code,
    name: displayNames.of(code) ?? code,
    dialCode: '+' + getCountryCallingCode(code)
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));