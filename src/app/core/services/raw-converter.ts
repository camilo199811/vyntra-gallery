
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RawConverterService {

  private readonly apiUrl =
    'http://127.0.0.1:8080';

  isRawFile(file: File): boolean {
    return /\.arw$/i.test(file.name);
  }

  async convertToJpg(file: File): Promise<File> {

    if (!this.isRawFile(file)) {
      return file;
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    let response: Response;

    try {
      response = await fetch(
        `${this.apiUrl}/convert`,
        {
          method: 'POST',
          body: formData
        }
      );
    } catch {
      throw new Error(
        'No fue posible conectar con el conversor RAW. ' +
        'Verifica que el servidor Python esté encendido.'
      );
    }

    if (!response.ok) {
      let detail = 'No fue posible convertir la fotografía RAW.';

      try {
        const result = await response.json();
        if (typeof result.detail === 'string') {
          detail = result.detail;
        }
      } catch {
        // Mantener el mensaje predeterminado.
      }

      throw new Error(detail);
    }

    const blob = await response.blob();

    if (
      blob.size === 0 ||
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .includes('image/jpeg')
    ) {
      throw new Error(
        'El conversor no devolvió un JPG válido.'
      );
    }

    const jpgName = file.name.replace(
      /\.arw$/i,
      '.jpg'
    );

    return new File(
      [blob],
      jpgName,
      {
        type: 'image/jpeg',
        lastModified: Date.now()
      }
    );
  }
}
