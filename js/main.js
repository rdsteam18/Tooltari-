// ==========================================================================
// ToolTari Main.js - Core UI Orchestration & Controller
// Handles bindings, event configurations, layouts, and DOM states
// ==========================================================================

(function() {
  'use strict';

  // Global UI Variables
  const UI = {
    selectedFiles: [],
    
    // Core Elements
    hamburger: document.getElementById('hamburgerBtn'),
    mainNav: document.getElementById('mainNav'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    
    // Panels
    uploadPanel: document.getElementById('uploadPanel'),
    dashboardPanel: document.getElementById('dashboardPanel'),
    progressPanel: document.getElementById('progressPanel'),
    successPanel: document.getElementById('successPanel'),
    
    // Bindings
    fileList: document.getElementById('fileList'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressMessage: document.getElementById('progressMessage'),
    btnAction: document.getElementById('btnActionTrigger'),
    btnReset: document.getElementById('btnReset'),
    downloadAnchor: document.getElementById('downloadAnchor'),
    errorAlert: document.getElementById('errorAlert'),
    errorMessage: document.getElementById('errorMessage'),
    
    // Clipboard elements
    btnCopy: document.getElementById('btnCopy'),
    copySuccessTip: document.getElementById('copySuccessTip'),
    resultTextarea: document.getElementById('resultTextarea')
  };

  // Helper: Format file size
  function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 1. MOBILE RESPONSIVE HAMBURGER MENU
  if (UI.hamburger && UI.mainNav) {
    UI.hamburger.addEventListener('click', () => {
      UI.mainNav.classList.toggle('open');
      const icon = UI.hamburger.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
      }
    });
  }

  // 2. TEXT COPING UTILITIES
  if (UI.btnCopy && UI.resultTextarea) {
    UI.btnCopy.addEventListener('click', () => {
      UI.resultTextarea.select();
      UI.resultTextarea.setSelectionRange(0, 99999); // Mobile compatibility
      
      try {
        navigator.clipboard.writeText(UI.resultTextarea.value);
        if (UI.copySuccessTip) {
          UI.copySuccessTip.classList.add('show');
          setTimeout(() => {
            UI.copySuccessTip.classList.remove('show');
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    });
  }

  // 3. FILE DROPZONE LISTENERS
  if (UI.dropzone && UI.fileInput) {
    // Open selector on click
    UI.dropzone.addEventListener('click', () => {
      UI.fileInput.click();
    });

    // Drag-over styling
    UI.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      UI.dropzone.classList.add('dragover');
    });

    UI.dropzone.addEventListener('dragleave', () => {
      UI.dropzone.classList.remove('dragover');
    });

    UI.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      UI.dropzone.classList.remove('dragover');
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files);
      }
    });

    UI.fileInput.addEventListener('change', () => {
      if (UI.fileInput.files && UI.fileInput.files.length > 0) {
        handleFileSelection(UI.fileInput.files);
      }
    });
  }

  // Handle File imports
  function handleFileSelection(filesList) {
    const isMultiAllowed = UI.fileInput.hasAttribute('multiple');
    
    if (isMultiAllowed) {
      for (let i = 0; i < filesList.length; i++) {
        UI.selectedFiles.push(filesList[i]);
      }
    } else {
      // Single file only
      UI.selectedFiles = [filesList[0]];
    }

    renderFilesList();
    hideError();
    
    // Switch UI panels
    if (UI.uploadPanel) UI.uploadPanel.style.display = 'none';
    if (UI.dashboardPanel) {
      UI.dashboardPanel.style.display = 'block';
      UI.dashboardPanel.classList.add('animate-slide-up');
    }
  }

  // Render items inside file details list
  function renderFilesList() {
    if (!UI.fileList) return;
    UI.fileList.innerHTML = '';

    UI.selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      
      const fileIcon = getFileIcon(file.name);
      
      item.innerHTML = `
        <div class="file-details">
          <i class="fa-solid ${fileIcon}"></i>
          <span class="file-name" title="${file.name}">${file.name}</span>
          <span class="file-size">(${formatSize(file.size)})</span>
        </div>
        <button class="btn-remove-file" data-index="${index}" title="Remove file">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      
      UI.fileList.appendChild(item);
    });

    // Bind remove buttons
    const removeButtons = UI.fileList.querySelectorAll('.btn-remove-file');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'), 10);
        UI.selectedFiles.splice(index, 1);
        
        if (UI.selectedFiles.length === 0) {
          resetWorkspace();
        } else {
          renderFilesList();
        }
      });
    });
  }

  // Resolve FA icon class by extension
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) return 'fa-file-image';
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return 'fa-file-zipper';
    return 'fa-file-code';
  }

  // Error messaging helpers
  function showError(msg) {
    if (UI.errorAlert && UI.errorMessage) {
      UI.errorMessage.textContent = msg;
      UI.errorAlert.style.display = 'flex';
      UI.errorAlert.classList.add('animate-fade-in');
      
      // Auto scroll to error
      UI.errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(msg);
    }
  }

  function hideError() {
    if (UI.errorAlert) {
      UI.errorAlert.style.display = 'none';
    }
  }

  // Reset workspace layout back to dropzone
  function resetWorkspace() {
    UI.selectedFiles = [];
    if (UI.fileInput) UI.fileInput.value = '';
    
    if (UI.uploadPanel) {
      UI.uploadPanel.style.display = 'block';
      UI.uploadPanel.classList.add('animate-fade-in');
    }
    if (UI.dashboardPanel) UI.dashboardPanel.style.display = 'none';
    if (UI.progressPanel) UI.progressPanel.style.display = 'none';
    if (UI.successPanel) UI.successPanel.style.display = 'none';
    
    hideError();
  }

  if (UI.btnReset) {
    UI.btnReset.addEventListener('click', resetWorkspace);
  }

  // Local storage history logging helper
  function addHistoryEntry(toolName, inputSummary, resultSummary, status = 'Success') {
    try {
      const history = JSON.parse(localStorage.getItem('tooltari_history') || '[]');
      const newEntry = {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        toolName: toolName,
        timestamp: new Date().toISOString(),
        input: inputSummary || 'N/A',
        result: resultSummary || 'N/A',
        status: status
      };
      history.unshift(newEntry);
      if (history.length > 100) history.pop();
      localStorage.setItem('tooltari_history', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history entry', e);
    }
  }

  // Dynamic navigation links injection for History, Code Editor, Compiler
  document.addEventListener('DOMContentLoaded', () => {
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
      const ul = mainNav.querySelector('ul');
      if (ul) {
        // Clear active classes if we are on a custom page
        const path = window.location.pathname;
        
        // Add Compiler link
        if (!ul.querySelector('a[href*="compiler"]')) {
          const li = document.createElement('li');
          const isCompActive = path.includes('compiler');
          li.innerHTML = `<a href="/developer-tools/compiler.html" class="${isCompActive ? 'active' : ''}">Compiler</a>`;
          ul.appendChild(li);
        }
        // Add Code Editor link
        if (!ul.querySelector('a[href*="code-editor"]')) {
          const li = document.createElement('li');
          const isEdActive = path.includes('code-editor');
          li.innerHTML = `<a href="/developer-tools/code-editor.html" class="${isEdActive ? 'active' : ''}">Code Editor</a>`;
          ul.appendChild(li);
        }
        // Add History link
        if (!ul.querySelector('a[href*="history"]')) {
          const li = document.createElement('li');
          const isHistActive = path.includes('history');
          li.innerHTML = `<a href="/history.html" class="${isHistActive ? 'active' : ''}">History</a>`;
          ul.appendChild(li);
        }
      }
    }
  });

  // Export helper globally
  window.ToolTariUI = {
    UI,
    showError,
    hideError,
    resetWorkspace,
    formatSize,
    addHistoryEntry,
    
    // Switch visual panels helper
    showProgress(percent, msg) {
      if (UI.dashboardPanel) UI.dashboardPanel.style.display = 'none';
      if (UI.progressPanel) {
        UI.progressPanel.style.display = 'block';
        UI.progressPanel.classList.add('animate-fade-in');
      }
      if (UI.progressMessage) UI.progressMessage.textContent = msg;
      if (UI.progressBarFill) UI.progressBarFill.style.width = percent + '%';
    },

    showSuccess(downloadUrl, filename, toolName = 'Unknown Tool', inputSummary = '') {
      if (UI.progressPanel) UI.progressPanel.style.display = 'none';
      if (UI.successPanel) {
        UI.successPanel.style.display = 'block';
        UI.successPanel.classList.add('animate-slide-up');
      }
      if (UI.downloadAnchor) {
        UI.downloadAnchor.href = downloadUrl;
        UI.downloadAnchor.download = filename || 'tooltari_download';
      }

      // Auto-detect toolName from page header if not passed
      if (toolName === 'Unknown Tool') {
        const h1 = document.querySelector('h1');
        if (h1) {
          toolName = h1.textContent.trim();
        }
      }

      // Auto-detect inputSummary from selection list if empty
      if (!inputSummary && UI.selectedFiles && UI.selectedFiles.length > 0) {
        if (UI.selectedFiles.length === 1) {
          inputSummary = `${UI.selectedFiles[0].name} (${formatSize(UI.selectedFiles[0].size)})`;
        } else {
          inputSummary = `${UI.selectedFiles.length} files`;
        }
      }

      // Add to history
      const ext = filename ? filename.split('.').pop().toLowerCase() : '';
      const resultSummary = filename ? `${filename} (${ext.toUpperCase()})` : 'Compiled File';
      addHistoryEntry(toolName, inputSummary, resultSummary, 'Success');

      // Check if it's an image and show preview
      if (UI.successPanel && filename) {
        // Remove existing success preview if any
        const existingPreview = UI.successPanel.querySelector('.success-preview-container');
        if (existingPreview) existingPreview.remove();

        if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) {
          const previewDiv = document.createElement('div');
          previewDiv.className = 'success-preview-container';
          previewDiv.style.margin = '1.5rem auto';
          previewDiv.style.maxWidth = '300px';
          previewDiv.style.maxHeight = '200px';
          previewDiv.style.overflow = 'hidden';
          previewDiv.style.borderRadius = 'var(--radius-md)';
          previewDiv.style.border = '1px solid var(--border-color)';
          previewDiv.style.display = 'flex';
          previewDiv.style.justifyContent = 'center';
          previewDiv.style.alignItems = 'center';
          previewDiv.style.background = '#f1f5f9';
          previewDiv.style.boxShadow = 'var(--shadow-sm)';

          const img = document.createElement('img');
          img.src = downloadUrl;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.objectFit = 'contain';
          img.alt = 'Output Preview';

          previewDiv.appendChild(img);

          const screen = UI.successPanel.querySelector('.success-screen');
          if (screen) {
            const downloadBtn = screen.querySelector('.btn-download');
            if (downloadBtn) {
              screen.insertBefore(previewDiv, downloadBtn);
            } else {
              screen.appendChild(previewDiv);
            }
          }
        }
      }
    }
  };

  console.log('ToolTari UI Orchestration logic initialized.');
})();
