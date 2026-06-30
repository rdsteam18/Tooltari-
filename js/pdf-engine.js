// ==========================================================================
// ToolTari PDF Engine - Standalone Client-Side PDF Handler
// Runs entirely in user browser memory using pdf-lib
// ==========================================================================

(function() {
  'use strict';

  class PDFEngine {
    constructor() {
      this.pdfLib = null;
      this.loadingPromise = null;
    }

    // Initialize pdf-lib from window variable (loaded via CDN)
    async init() {
      if (typeof window.PDFLib !== 'undefined') {
        this.pdfLib = window.PDFLib;
        return true;
      }
      if (this.loadingPromise) return this.loadingPromise;

      this.loadingPromise = new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (typeof window.PDFLib !== 'undefined') {
            this.pdfLib = window.PDFLib;
            clearInterval(interval);
            resolve(true);
          } else if (attempts > 50) { // 5 seconds max wait
            clearInterval(interval);
            console.error('PDF-Lib library could not be resolved from CDN');
            resolve(false);
          }
        }, 100);
      });
      return this.loadingPromise;
    }

    // 1. MERGE PDFs
    async mergePDFs(files, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded. Check internet connection.');

      onProgress?.(15, 'Initializing PDF Document Workspace...');
      const mergedDoc = await this.pdfLib.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressPercent = 15 + Math.floor((i / files.length) * 70);
        onProgress?.(progressPercent, `Importing page contents from "${file.name}"...`);

        const fileBytes = await file.arrayBuffer();
        const docToImport = await this.pdfLib.PDFDocument.load(fileBytes);
        const pages = await mergedDoc.copyPages(docToImport, docToImport.getPageIndices());
        pages.forEach((page) => mergedDoc.addPage(page));
      }

      onProgress?.(90, 'Serializing and packing merged elements...');
      const mergedBytes = await mergedDoc.save();
      onProgress?.(100, 'Completed!');
      return new Blob([mergedBytes], { type: 'application/pdf' });
    }

    // 2. SPLIT PDF BY RANGES
    async splitPDF(file, rangesStr, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      onProgress?.(20, 'Reading PDF catalogs...');
      const fileBytes = await file.arrayBuffer();
      const sourceDoc = await this.pdfLib.PDFDocument.load(fileBytes);
      const totalPages = sourceDoc.getPageCount();
      const outputBlobs = [];

      const ranges = rangesStr.split(',').map(r => r.trim());
      onProgress?.(45, 'Segmenting pages...');
      
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (!range) continue;
        const parts = range.split('-');
        let start = parseInt(parts[0], 10) - 1;
        let end = parts[1] ? parseInt(parts[1], 10) - 1 : start;

        if (isNaN(start) || start < 0 || start >= totalPages) continue;
        if (isNaN(end) || end < 0 || end >= totalPages) end = start;

        const newDoc = await this.pdfLib.PDFDocument.create();
        const indices = Array.from({ length: end - start + 1 }, (_, index) => start + index);
        const copiedPages = await newDoc.copyPages(sourceDoc, indices);
        copiedPages.forEach((page) => newDoc.addPage(page));

        const bytes = await newDoc.save();
        outputBlobs.push({
          blob: new Blob([bytes], { type: 'application/pdf' }),
          name: `${file.name.replace(/\.[^/.]+$/, "")}_pages_${start + 1}-${end + 1}.pdf`
        });
      }

      onProgress?.(100, 'Split completed!');
      return outputBlobs;
    }

    // 3. COMPRESS PDF
    async compressPDF(file, compressionLevel = 'recommended', onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      let quality = 0.65;
      let maxDimension = 1200;
      if (compressionLevel === 'low') {
        quality = 0.85;
        maxDimension = 1600;
      } else if (compressionLevel === 'extreme') {
        quality = 0.4;
        maxDimension = 800;
      }

      onProgress?.(10, 'Reading PDF structure...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);

      const enumeratedObjects = doc.context.enumerateIndirectObjects();
      const imageRefs = [];

      onProgress?.(25, 'Analyzing image streams...');
      for (const [ref, obj] of enumeratedObjects) {
        if (obj instanceof this.pdfLib.PDFRawStream) {
          const subtype = obj.dict.get(this.pdfLib.PDFName.of('Subtype'));
          if (subtype?.toString() === '/Image') {
            imageRefs.push({ ref, obj });
          }
        }
      }

      let compressedCount = 0;
      const totalImages = imageRefs.length;
      onProgress?.(35, `Found ${totalImages} image(s) to optimize...`);

      for (let i = 0; i < totalImages; i++) {
        const { ref, obj } = imageRefs[i];
        const percent = 35 + Math.floor((i / totalImages) * 55);
        onProgress?.(percent, `Optimizing image ${i + 1} of ${totalImages}...`);

        try {
          const filter = obj.dict.get(this.pdfLib.PDFName.of('Filter'));
          const isDCT = filter?.toString() === '/DCTDecode' || 
                        (filter instanceof this.pdfLib.PDFArray && filter.toString().includes('/DCTDecode'));
          
          if (isDCT) {
            const rawBytes = obj.contents;
            const compressed = await this.compressImageBytes(rawBytes, quality, maxDimension);
            
            const newDict = obj.dict.clone(doc.context);
            newDict.set(this.pdfLib.PDFName.of('Length'), this.pdfLib.PDFNumber.of(compressed.bytes.length));
            newDict.set(this.pdfLib.PDFName.of('Width'), this.pdfLib.PDFNumber.of(compressed.width));
            newDict.set(this.pdfLib.PDFName.of('Height'), this.pdfLib.PDFNumber.of(compressed.height));
            
            const newStream = this.pdfLib.PDFRawStream.of(newDict, compressed.bytes);
            doc.context.assign(ref, newStream);
            compressedCount++;
          }
        } catch (err) {
          console.warn(`Failed to compress image ${i + 1}:`, err);
        }
      }

      onProgress?.(90, 'Re-building visual layouts and saving...');
      const compressedBytes = await doc.save({
        useObjectStreams: true,
        addOriginalMetadata: false
      });

      onProgress?.(100, 'Compression completed!');
      return {
        blob: new Blob([compressedBytes], { type: 'application/pdf' }),
        imagesProcessed: totalImages,
        imagesCompressed: compressedCount
      };
    }

    // Helper to compress image byte arrays in-browser via canvas
    compressImageBytes(bytes, quality, maxDimension) {
      return new Promise((resolve, reject) => {
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          let width = img.width;
          let height = img.height;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((resultBlob) => {
            if (!resultBlob) {
              reject(new Error('Canvas conversion returned null'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                bytes: new Uint8Array(reader.result),
                width: width,
                height: height
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(resultBlob);
          }, 'image/jpeg', quality);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });
    }

    // 4. PROTECT PDF (ENCRYPT)
    async protectPDF(file, password, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');
      if (!password) throw new Error('Password cannot be empty.');

      onProgress?.(30, 'Decrypting workspace catalog...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);

      onProgress?.(60, 'Enforcing 128-bit encryption keys...');
      doc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false
        }
      });

      const encryptedBytes = await doc.save();
      onProgress?.(100, 'Document protected!');
      return new Blob([encryptedBytes], { type: 'application/pdf' });
    }

    // 5. UNLOCK PDF
    async unlockPDF(file, password, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      onProgress?.(40, 'Decrypting PDF catalog keys...');
      const fileBytes = await file.arrayBuffer();
      
      try {
        const doc = await this.pdfLib.PDFDocument.load(fileBytes, { password });
        onProgress?.(70, 'Stripping permission envelopes...');
        const decryptedBytes = await doc.save(); // save removes encryption headers when loaded with key
        
        onProgress?.(100, 'Unlocked!');
        return new Blob([decryptedBytes], { type: 'application/pdf' });
      } catch (err) {
        throw new Error('Incorrect password. Failed to decrypt PDF.');
      }
    }

    // 6. ROTATE PDF
    async rotatePDF(file, angle, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      onProgress?.(30, 'Loading page streams...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);
      const pages = doc.getPages();

      onProgress?.(60, `Rotating pages by ${angle} degrees...`);
      for (const page of pages) {
        const currentRotation = page.getRotation().angle || 0;
        page.setRotation(this.pdfLib.degrees((currentRotation + angle) % 360));
      }

      const rotatedBytes = await doc.save();
      onProgress?.(100, 'Rotation saved!');
      return new Blob([rotatedBytes], { type: 'application/pdf' });
    }

    // 7. ADD WATERMARK
    async watermarkPDF(file, text, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');
      if (!text) throw new Error('Watermark text cannot be empty.');

      onProgress?.(25, 'Embedding base fonts...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);
      const font = await doc.embedFont(this.pdfLib.StandardFonts.HelveticaBold);
      const pages = doc.getPages();

      onProgress?.(60, 'Stamping page matrices...');
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(text, {
          x: width / 5,
          y: height / 2.5,
          size: Math.round(width / 12),
          font: font,
          color: this.pdfLib.rgb(0.7, 0.7, 0.7),
          opacity: 0.25,
          rotate: this.pdfLib.degrees(40)
        });
      }

      const bytes = await doc.save();
      onProgress?.(100, 'Watermark stamp applied!');
      return new Blob([bytes], { type: 'application/pdf' });
    }

    // 8. ADD PAGE NUMBERS
    async addPageNumbers(file, position, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      onProgress?.(30, 'Embedding typography parameters...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);
      const font = await doc.embedFont(this.pdfLib.StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;

      onProgress?.(65, 'Drawing page headers and footers...');
      for (let i = 0; i < total; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const label = `Page ${i + 1} of ${total}`;
        const fontSize = 10;
        const textWidth = font.widthOfTextAtSize(label, fontSize);

        const x = (width - textWidth) / 2;
        const y = position === 'top' ? height - 30 : 30;

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font: font,
          color: this.pdfLib.rgb(0.2, 0.2, 0.2)
        });
      }

      const bytes = await doc.save();
      onProgress?.(100, 'Pagination tags written!');
      return new Blob([bytes], { type: 'application/pdf' });
    }

    // 9. DELETE PAGES
    async deletePages(file, pagesStr, onProgress) {
      const ok = await this.init();
      if (!ok) throw new Error('PDF library is not loaded.');

      onProgress?.(25, 'Validating pages ranges...');
      const fileBytes = await file.arrayBuffer();
      const doc = await this.pdfLib.PDFDocument.load(fileBytes);
      const totalPages = doc.getPageCount();

      // Parse comma separated page indexes (1-indexed based string input)
      const list = pagesStr.split(',').map(item => parseInt(item.trim(), 10) - 1);
      // Filter out invalid page indices
      const sortedToDelete = [...new Set(list)]
        .filter(idx => !isNaN(idx) && idx >= 0 && idx < totalPages)
        .sort((a, b) => b - a); // Sort in descending order to avoid shift issues

      if (sortedToDelete.length === 0) throw new Error('No valid page numbers provided.');
      if (sortedToDelete.length >= totalPages) throw new Error('Cannot delete all pages of a PDF document.');

      onProgress?.(60, 'Purging objects from catalog tree...');
      for (const idx of sortedToDelete) {
        doc.removePage(idx);
      }

      const bytes = await doc.save();
      onProgress?.(100, 'Deletion completed!');
      return new Blob([bytes], { type: 'application/pdf' });
    }
  }

  window.ToolTariPDFEngine = new PDFEngine();
  console.log('ToolTari PDF engine initialized successfully.');
})();
