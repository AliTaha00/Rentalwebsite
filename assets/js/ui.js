// UI helpers: toast notifications and confirm dialogs
// Exposes window.UI with showToast and confirm methods

(function() {
    const TOAST_LIFETIME_MS = 3000;

    function ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', options = {}) {
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        const lifetime = typeof options.duration === 'number' ? options.duration : TOAST_LIFETIME_MS;
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 200);
        }, lifetime);
    }

    function confirmDialog({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary' } = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            const modal = document.createElement('div');
            modal.className = 'modal-content';
            modal.innerHTML = `
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer" style="display:flex;gap:0.75rem;justify-content:flex-end;">
                    <button class="btn btn-secondary" data-action="cancel">${cancelText}</button>
                    <button class="btn btn-${variant}" data-action="confirm">${confirmText}</button>
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
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
        });
    }

    window.UI = {
        showToast,
        confirm: confirmDialog
    };
})();


