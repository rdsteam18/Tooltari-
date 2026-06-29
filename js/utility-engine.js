// ==========================================================================
// ToolTari Utility Engine - Standalone Developers & Text Calculators
// Runs client-side in-browser. Zero server communication.
// ==========================================================================

(function() {
  'use strict';

  const UtilityEngine = {
    // 1. SECURE PASSWORD GENERATION
    generatePassword(length = 16, config = {}) {
      const upperCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowerCharset = 'abcdefghijklmnopqrstuvwxyz';
      const numbersCharset = '0123456789';
      const symbolsCharset = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      // Support both short names (upper, lower, nums) and long names (uppercase, lowercase, numbers)
      const hasUpper = config.upper !== undefined ? config.upper : config.uppercase;
      const hasLower = config.lower !== undefined ? config.lower : config.lowercase;
      const hasNums = config.nums !== undefined ? config.nums : config.numbers;
      const hasSymbols = config.symbols !== undefined ? config.symbols : config.symbols;

      let activeCharset = '';
      if (hasUpper !== false && (hasUpper || config.upper === undefined)) activeCharset += upperCharset;
      if (hasLower !== false && (hasLower || config.lower === undefined)) activeCharset += lowerCharset;
      if (hasNums !== false && (hasNums || config.nums === undefined)) activeCharset += numbersCharset;
      if (hasSymbols !== false && (hasSymbols || config.symbols === undefined)) activeCharset += symbolsCharset;

      if (!activeCharset) {
        // Fallback if none selected
        activeCharset = lowerCharset + numbersCharset;
      }

      let password = '';
      const cryptoObj = window.crypto || window.msCrypto;

      if (cryptoObj && cryptoObj.getRandomValues) {
        const randomValues = new Uint32Array(length);
        cryptoObj.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
          password += activeCharset.charAt(randomValues[i] % activeCharset.length);
        }
      } else {
        // Math.random fallback
        for (let i = 0; i < length; i++) {
          password += activeCharset.charAt(Math.floor(Math.random() * activeCharset.length));
        }
      }

      return password;
    },

    // Password Strength Evaluator
    checkStrength(password) {
      let score = 0;
      if (!password) return { score: 0, text: 'Empty', color: '#cbd5e1' };

      if (password.length >= 8) score++;
      if (password.length >= 14) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[a-z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;

      const levels = [
        { text: 'Too Weak', color: '#ef4444' },
        { text: 'Weak', color: '#f97316' },
        { text: 'Fair', color: '#eab308' },
        { text: 'Good', color: '#84cc16' },
        { text: 'Strong', color: '#22c55e' },
        { text: 'Super Secure', color: '#10b981' }
      ];

      return levels[Math.min(5, score)];
    },

    // 2. BASE64 ENCODING AND DECODING
    base64Encode(text) {
      try {
        return btoa(unescape(encodeURIComponent(text)));
      } catch (err) {
        throw new Error('Base64 encoding failed: content contains invalid bytes.');
      }
    },

    base64Decode(encodedText) {
      try {
        return decodeURIComponent(escape(atob(encodedText)));
      } catch (err) {
        throw new Error('Invalid Base64 string sequence.');
      }
    },

    // 3. QR CODE GENERATION
    async generateQRCode(text, canvasElement, options = {}) {
      if (typeof window.QRCode === 'undefined') {
        throw new Error('QR code script has not finished loading.');
      }
      
      const config = {
        text: text,
        width: options.width || 256,
        height: options.height || 256,
        colorDark: options.colorDark || "#000000",
        colorLight: options.colorLight || "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      };

      // Clear container and create new QR canvas
      canvasElement.innerHTML = '';
      
      return new Promise((resolve) => {
        new window.QRCode(canvasElement, config);
        // Wait slightly for canvas generation
        setTimeout(() => {
          resolve(true);
        }, 100);
      });
    },

    // 4. TEXT CASE CONVERSION
    convertCase(text, style) {
      switch (style) {
        case 'upper':
          return text.toUpperCase();
        case 'lower':
          return text.toLowerCase();
        case 'title':
          return text.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
        case 'sentence':
          if (!text) return '';
          return text.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, s => s.toUpperCase());
        case 'inverse':
          return text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
        default:
          return text;
      }
    },

    // 5. DETAILED WORD COUNTER
    analyzeText(text) {
      const charCount = text.length;
      const charNoSpaces = text.replace(/\s/g, '').length;
      
      const wordsArray = text.trim() === '' ? [] : text.trim().split(/\s+/);
      const wordCount = wordsArray.length;
      
      const linesArray = text === '' ? [] : text.split(/\r\n|\r|\n/);
      const lineCount = linesArray.length;
      
      const sentencesArray = text === '' ? [] : text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const sentenceCount = sentencesArray.length;

      const paragraphsArray = text === '' ? [] : text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const paragraphCount = paragraphsArray.length;

      // Estimate reading time: average adult reads at ~200 WPM
      const readingTimeMinutes = Math.ceil(wordCount / 200);

      return {
        characters: charCount,
        charactersNoSpaces: charNoSpaces,
        words: wordCount,
        lines: lineCount,
        sentences: sentenceCount,
        paragraphs: paragraphCount,
        readingTime: readingTimeMinutes
      };
    }
  };

  window.ToolTariUtilityEngine = UtilityEngine;
  console.log('ToolTari Utility calculations engine initialized.');
})();
