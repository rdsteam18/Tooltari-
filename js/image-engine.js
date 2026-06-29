// ==========================================================================
// ToolTari Image Engine - Client-Side Canvas Image Processor
// Runs locally in browser memory without sending data to servers
// ==========================================================================

(function() {
  'use strict';

  class ImageEngine {
    constructor() {}

    // Load file into an HTML Image Element
    loadImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Invalid image file.'));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
    }

    // Convert Canvas to Blob helper
    canvasToBlob(canvas, type, quality) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, type, quality);
      });
    }

    // 1. COMPRESS IMAGE
    async compressImage(file, quality, onProgress) {
      onProgress?.(30, 'Decoding image raster streams...');
      const img = await this.loadImage(file);
      
      onProgress?.(60, 'Initializing graphic canvas buffers...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw original image onto canvas
      ctx.drawImage(img, 0, 0);
      
      onProgress?.(80, `Applying compression matrices at ${Math.round(quality * 100)}% quality...`);
      // Target format is jpeg or webp for lossy slider compression. default back to source type
      let targetMime = file.type;
      if (file.type === 'image/png') {
        // PNG is lossless, so convert to JPEG/WEBP to achieve compression, otherwise output is identical
        targetMime = 'image/jpeg';
      }
      
      const blob = await this.canvasToBlob(canvas, targetMime, quality);
      onProgress?.(100, 'Image compressed successfully!');
      return {
        blob,
        mimeType: targetMime,
        filename: file.name.replace(/\.[^/.]+$/, "") + '_compressed.' + (targetMime === 'image/webp' ? 'webp' : 'jpg')
      };
    }

    // 2. RESIZE IMAGE
    async resizeImage(file, width, height, onProgress) {
      onProgress?.(30, 'Decoding image dimensions...');
      const img = await this.loadImage(file);
      
      onProgress?.(60, 'Initializing canvas scaling grid...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = parseInt(width, 10) || img.naturalWidth;
      canvas.height = parseInt(height, 10) || img.naturalHeight;
      
      onProgress?.(80, 'Interpolating pixels...');
      // Draw image scaled
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const blob = await this.canvasToBlob(canvas, file.type, 0.92);
      onProgress?.(100, 'Image resized!');
      return {
        blob,
        mimeType: file.type,
        filename: file.name.replace(/\.[^/.]+$/, "") + `_resized_${canvas.width}x${canvas.height}.` + (file.type.split('/')[1] || 'png')
      };
    }

    // 3. CONVERT IMAGE
    async convertImage(file, targetFormat, onProgress) {
      onProgress?.(30, 'Analyzing file payload...');
      const img = await this.loadImage(file);
      
      onProgress?.(60, 'Mapping canvas rendering buffers...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      onProgress?.(85, `Encoding format to ${targetFormat.toUpperCase()}...`);
      let mimeType = 'image/png';
      let extension = 'png';
      
      if (targetFormat.toLowerCase() === 'jpeg' || targetFormat.toLowerCase() === 'jpg') {
        mimeType = 'image/jpeg';
        extension = 'jpg';
        // Fill white background for JPEG conversion (since JPEG lacks alpha transparency channel)
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (targetFormat.toLowerCase() === 'webp') {
        mimeType = 'image/webp';
        extension = 'webp';
      }
      
      const blob = await this.canvasToBlob(canvas, mimeType, 0.95);
      onProgress?.(100, 'Conversion completed!');
      return {
        blob,
        mimeType,
        filename: file.name.replace(/\.[^/.]+$/, "") + `_converted.${extension}`
      };
    }

    // 4. ROTATE IMAGE
    async rotateImage(file, angle, onProgress) {
      onProgress?.(30, 'Mapping canvas coordinate vectors...');
      const img = await this.loadImage(file);
      
      onProgress?.(60, 'Translating rotation matrix...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const normalizedAngle = (angle % 360 + 360) % 360;
      
      if (normalizedAngle === 90 || normalizedAngle === 270) {
        canvas.width = img.naturalHeight;
        canvas.height = img.naturalWidth;
      } else {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      
      // Set rotation parameters
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedAngle * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      
      onProgress?.(85, 'Finalizing output pixels...');
      const blob = await this.canvasToBlob(canvas, file.type, 0.92);
      onProgress?.(100, 'Image rotation complete!');
      return {
        blob,
        mimeType: file.type,
        filename: file.name.replace(/\.[^/.]+$/, "") + `_rotated_${normalizedAngle}.` + (file.type.split('/')[1] || 'png')
      };
    }
  }

  window.ToolTariImageEngine = new ImageEngine();
  console.log('ToolTari Image engine loaded.');
})();
