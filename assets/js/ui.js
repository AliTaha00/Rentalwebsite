(function() {
    'use strict';

    const TOAST_LIFETIME_MS = 3000;
    const ALLOWED_TOAST_TYPES = new Set(['info', 'success', 'error', 'warning']);
    const ALLOWED_BUTTON_VARIANTS = new Set(['primary', 'secondary', 'success', 'danger', 'warning']);

    function sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', options = {}) {
        if (typeof message !== 'string') {
            console.error('Toast message must be a string');
            return;
        }

        const safeType = ALLOWED_TOAST_TYPES.has(type) ? type : 'info';
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${safeType}`;
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        container.appendChild(toast);

        const lifetime = typeof options.duration === 'number' && options.duration > 0
            ? Math.min(options.duration, 10000)
            : TOAST_LIFETIME_MS;

        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 200);
        }, lifetime);
    }

    function confirmDialog({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary' } = {}) {
        return new Promise((resolve) => {
            const safeVariant = ALLOWED_BUTTON_VARIANTS.has(variant) ? variant : 'primary';
            const safeTitle = sanitizeText(String(title));
            const safeMessage = sanitizeText(String(message));
            const safeConfirmText = sanitizeText(String(confirmText));
            const safeCancelText = sanitizeText(String(cancelText));

            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'modal-title');

            const modal = document.createElement('div');
            modal.className = 'modal-content';
            modal.innerHTML = `
                <div class="modal-header">
                    <h2 id="modal-title">${safeTitle}</h2>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${safeMessage}</p>
                </div>
                <div class="modal-footer" style="display:flex;gap:0.75rem;justify-content:flex-end;">
                    <button class="btn btn-secondary" data-action="cancel">${safeCancelText}</button>
                    <button class="btn btn-${safeVariant}" data-action="confirm">${safeConfirmText}</button>
                </div>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
            modal.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
            modal.querySelector('.modal-close').addEventListener('click', () => cleanup(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });

            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            confirmBtn.focus();
        });
    }

    window.UI = Object.freeze({
        showToast,
        confirm: confirmDialog
    });
})();


