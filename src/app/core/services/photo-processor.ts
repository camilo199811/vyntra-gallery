
import { Injectable } from '@angular/core';

export interface ProcessedPhoto {
  preview: Blob;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoProcessorService {

  private readonly supportedImages = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  private readonly rawExtensions = [
    'cr2',
    'cr3',
    'nef',
    'arw',
    'dng',
    'raf',
    'orf',
    'rw2',
    'pef'
  ];

  isRawFile(file: File): boolean {
    const extension = this.getExtension(file.name);
    return this.rawExtensions.includes(extension);
  }

  isSupportedFile(file: File): boolean {
    const extension = this.getExtension(file.name);

    return this.supportedImages.includes(file.type)
      || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
      || this.rawExtensions.includes(extension);
  }

  private getExtension(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
  }

  async processPhoto(
    file: File,
    watermarkEnabled = true
  ): Promise<ProcessedPhoto> {

    if (this.isRawFile(file)) {
      throw new Error(
        'El archivo RAW debe convertirse a JPG antes de generar la vista previa.'
      );
    }

    if (!this.supportedImages.includes(file.type)) {
      throw new Error(
        'Formato de imagen no permitido.'
      );
    }

    const image = await createImageBitmap(file);

    try {
      const width = image.width;
      const height = image.height;

      const maxDimension = 1800;

      const scale = Math.min(
        1,
        maxDimension / Math.max(width, height)
      );

      const previewWidth = Math.max(
        1,
        Math.round(width * scale)
      );

      const previewHeight = Math.max(
        1,
        Math.round(height * scale)
      );

      const canvas = document.createElement('canvas');

      canvas.width = previewWidth;
      canvas.height = previewHeight;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'No fue posible preparar la fotografía.'
        );
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      context.drawImage(
        image,
        0,
        0,
        previewWidth,
        previewHeight
      );

      if (watermarkEnabled) {
        this.drawWatermark(
          context,
          previewWidth,
          previewHeight
        );
      }

      const preview = await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            blob => {
              if (blob) {
                resolve(blob);
              } else {
                reject(
                  new Error(
                    'No fue posible generar la vista previa.'
                  )
                );
              }
            },
            'image/webp',
            0.85
          );
        }
      );

      return {
        preview,
        width,
        height
      };

    } finally {
      image.close();
    }
  }

  private drawWatermark(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {

    const fontSize = Math.max(
      14,
      Math.round(Math.min(width, height) * 0.045)
    );

    const spacingX = fontSize * 7;
    const spacingY = fontSize * 5;

    context.save();

    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 6);
    context.translate(-width / 2, -height / 2);

    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillStyle = 'rgba(255, 255, 255, 0.32)';
    context.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    context.lineWidth = Math.max(
      1,
      fontSize * 0.035
    );

    for (
      let y = -height;
      y < height * 2;
      y += spacingY
    ) {
      for (
        let x = -width;
        x < width * 2;
        x += spacingX
      ) {
        context.strokeText('VYNTRA', x, y);
        context.fillText('VYNTRA', x, y);
      }
    }

    context.restore();
  }
}
