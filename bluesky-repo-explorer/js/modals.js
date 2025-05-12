function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open'); // Add class to body
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open'); // Remove class from body
    }
    if (modalId === 'loginModal') {
        const loginErrorEl = document.getElementById('loginError');
        if (loginErrorEl) {
            loginErrorEl.classList.add('hidden');
            loginErrorEl.textContent = '';
        }
    }
    if (modalId === 'customStatusModal' || modalId === 'deleteConfirmModal') {
        const detailsEl = document.getElementById('customStatusDetails'); // Assuming delete confirm doesn't have this, but good to check
        if (detailsEl) detailsEl.classList.add('hidden');
        if (modalId === 'deleteConfirmModal') { // Reset delete confirm input
            const confirmInput = document.getElementById('deleteConfirmInput');
            if (confirmInput) confirmInput.value = '';
            const confirmButton = document.getElementById('deleteConfirmYesButton');
            if (confirmButton) confirmButton.disabled = true;
        }
    }
}

function setupModalCloseButtons() {
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.dataset.modalId;
            if (modalId) {
                closeModal(modalId);
            } else {
                button.closest('.modal').classList.add('hidden');
                document.body.classList.remove('modal-open'); // General fallback
            }
        });
    });
}

function showCustomStatusModal({ title = 'Status', message, details = null, onOk = null }) {
    const titleEl = document.getElementById('customStatusTitle');
    const messageEl = document.getElementById('customStatusMessage');
    const okButton = document.getElementById('customStatusOkButton');
    const detailsContainer = document.getElementById('customStatusDetails');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (okButton) {
        const newOkButton = okButton.cloneNode(true);
        okButton.parentNode.replaceChild(newOkButton, okButton);
        newOkButton.onclick = () => {
            closeModal('customStatusModal');
            if (onOk) onOk();
        };
    }

    if (details && detailsContainer) {
        const statusTotalEl = document.getElementById('statusTotal');
        const statusSuccessEl = document.getElementById('statusSuccess');
        const statusFailedEl = document.getElementById('statusFailed');
        const statusRemainingEl = document.getElementById('statusRemaining');

        if (statusTotalEl) statusTotalEl.textContent = details.total || 'N/A';
        if (statusSuccessEl) statusSuccessEl.textContent = details.success || '0';
        if (statusFailedEl) statusFailedEl.textContent = details.failed || '0';
        if (statusRemainingEl) statusRemainingEl.textContent = details.remaining || 'N/A';
        detailsContainer.classList.remove('hidden');
    } else if (detailsContainer) {
        detailsContainer.classList.add('hidden');
    }
    openModal('customStatusModal');
}

// Standard Confirm Modal (not for delete anymore)
function showCustomConfirm({ title = 'Confirm', message, onConfirm, onCancel = null }) {
    // ... (remains the same as your last full version) ...
    const titleEl = document.getElementById('customConfirmTitle');
    const messageEl = document.getElementById('customConfirmMessage');
    const yesButton = document.getElementById('customConfirmYesButton');
    const noButton = document.getElementById('customConfirmNoButton');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (yesButton && noButton) {
        const newYesButton = yesButton.cloneNode(true);
        yesButton.parentNode.replaceChild(newYesButton, yesButton);
        const newNoButton = noButton.cloneNode(true);
        noButton.parentNode.replaceChild(newNoButton, noButton);

        newYesButton.onclick = () => {
            closeModal('customConfirmModal');
            if (onConfirm) onConfirm();
        };
        newNoButton.onclick = () => {
            closeModal('customConfirmModal');
            if (onCancel) onCancel();
        };
    }
    openModal('customConfirmModal');
}

// New Delete Confirm Modal with input
function showDeleteConfirmModal({ title = 'Confirm Deletion', message, onConfirm, onCancel = null }) {
    const titleEl = document.getElementById('deleteConfirmTitle');
    const messageEl = document.getElementById('deleteConfirmMessage');
    const confirmInput = document.getElementById('deleteConfirmInput');
    const yesButton = document.getElementById('deleteConfirmYesButton');
    const noButton = document.getElementById('deleteConfirmNoButton');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (confirmInput) confirmInput.value = ''; // Reset input
    if (yesButton) yesButton.disabled = true; // Disable confirm initially

    const newYesButton = yesButton.cloneNode(true);
    yesButton.parentNode.replaceChild(newYesButton, yesButton);
    const newNoButton = noButton.cloneNode(true);
    noButton.parentNode.replaceChild(newNoButton, noButton);

    if (confirmInput && newYesButton) {
        confirmInput.oninput = () => {
            newYesButton.disabled = confirmInput.value !== 'CONFIRM';
        };
    }

    if (newYesButton) {
        newYesButton.onclick = () => {
            if (confirmInput && confirmInput.value === 'CONFIRM') {
                closeModal('deleteConfirmModal');
                if (onConfirm) onConfirm();
            } else {
                // Optionally show an error if they click without typing CONFIRM
                // (though button is disabled)
            }
        };
    }
    if (newNoButton) {
        newNoButton.onclick = () => {
            closeModal('deleteConfirmModal');
            if (onCancel) onCancel();
        };
    }
    openModal('deleteConfirmModal');
}


function showLoginError(message) {
    const loginErrorEl = document.getElementById('loginError');
    if (loginErrorEl) {
        loginErrorEl.textContent = message;
        loginErrorEl.classList.remove('hidden');
    }
}