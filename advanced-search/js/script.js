// script.js

const BASE_URL = 'https://bsky.app/search?q=';

function encodeSearchTerm(term) {
    return encodeURIComponent(term);
}

function openSearch(searchTerm) {
    window.open(BASE_URL + encodeSearchTerm(searchTerm), '_blank');
}

function removeAtSymbol(username) {
    return username.replace('@', '');
}

function cleanHashtag(hashtag) {
    return hashtag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function searchSuper() {
    const fromUser = removeAtSymbol(document.getElementById('superFromUser').value.trim());
    const toUser = removeAtSymbol(document.getElementById('superToUser').value.trim());
    const mentions = removeAtSymbol(document.getElementById('superMentions').value.trim());
    const exactUsername = removeAtSymbol(document.getElementById('superExactUsername').value.trim());
    const domainInput = document.getElementById('superDomain').value.trim();
    const since = document.getElementById('superSince').value;
    const until = document.getElementById('superUntil').value;
    const phrase = document.getElementById('superPhrase').value.trim();
    const hashtag = cleanHashtag(document.getElementById('superHashtag').value.trim());

    let searchTerm = '';

    if (fromUser) searchTerm += `from:${fromUser} `;
    if (toUser) searchTerm += `to:${toUser} `;
    if (mentions) searchTerm += `mentions:${mentions} `;
    if (exactUsername) searchTerm += `"@${exactUsername}" `;
    if (domainInput) {
        try {
            const domain = new URL(domainInput).hostname.replace('www.', '');
            searchTerm += `domain:${domain} `;
        } catch (e) {
            console.warn("Invalid URL for domain extraction:", domainInput);
        }
    }
    if (since) searchTerm += `since:${since} `;
    if (until) searchTerm += `until:${until} `;
    if (phrase) searchTerm += `"${phrase}" `;
    if (hashtag) searchTerm += `#${hashtag} `;

    searchTerm = searchTerm.trim();

    if (searchTerm) {
        openSearch(searchTerm);
    } else {
        alert('Please fill at least one field.');
    }
}

function initThemeSwitcher() {
    const actionsContainer = document.querySelector('header .actions');
    if (!actionsContainer) return;

    const themeSwitcher = document.createElement('button');
    themeSwitcher.className = 'theme-button';
    themeSwitcher.innerHTML = '<i class="ph-fill ph-sun-dim"></i>';
    themeSwitcher.setAttribute('aria-label', 'Switch theme');
    themeSwitcher.setAttribute('title', 'Switch theme');

    if (actionsContainer.firstChild) {
        actionsContainer.insertBefore(themeSwitcher, actionsContainer.firstChild);
    } else {
        actionsContainer.appendChild(themeSwitcher);
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        themeSwitcher.innerHTML = '<i class="ph-fill ph-moon"></i>';
    }

    themeSwitcher.addEventListener('click', () => {
        const isLightTheme = document.documentElement.classList.toggle('light-theme');
        if (isLightTheme) {
            themeSwitcher.innerHTML = '<i class="ph-fill ph-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            themeSwitcher.innerHTML = '<i class="ph-fill ph-sun-dim"></i>';
            localStorage.setItem('theme', 'dark');
        }
    });
}

function initClearButton() {
    const form = document.querySelector('.search-section form');
    if (!form) return;

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'clear-button';
    clearButton.textContent = 'Clear';

    clearButton.addEventListener('click', () => {
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.value = '';
        });
        localStorage.removeItem('formData');
        const firstInput = form.querySelector('input, textarea');
        if (firstInput) firstInput.focus();
    });

    const searchButton = form.querySelector('.search-button');
    if (searchButton) {
        searchButton.parentNode.insertBefore(clearButton, searchButton.nextSibling);
    } else {
        form.appendChild(clearButton);
    }
}

function saveFormData() {
    const form = document.querySelector('.search-section form');
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea');
    const formData = {};

    inputs.forEach(input => {
        formData[input.id] = input.value;
    });

    localStorage.setItem('formData', JSON.stringify(formData));
}

function loadFormData() {
    const savedData = localStorage.getItem('formData');
    if (!savedData) return;

    try {
        const formData = JSON.parse(savedData);
        for (const id in formData) {
            const input = document.getElementById(id);
            if (input && formData[id]) {
                input.value = formData[id];
            }
        }
    } catch (error) {
        console.error('Error loading form data:', error);
    }
}

function initDatePickers() {
    const dateInputs = document.querySelectorAll('input[type="date"].input-field');

    dateInputs.forEach(dateInput => {
        // Using 'mousedown' can sometimes be more effective for triggering actions
        // before the browser's default click behavior fully processes.
        dateInput.addEventListener('mousedown', function(event) {
            // We only want to try and show the picker if the click wasn't on the
            // browser's native calendar icon itself, as that would be redundant
            // and could potentially cause issues if showPicker() is called twice.
            // This is a bit tricky because the icon is part of the shadow DOM
            // or is a browser-internal element not directly targetable with event.target.
            // A simple heuristic: if the click is very close to the right edge,
            // it might be on the icon. However, this is not foolproof.
            // For now, let's assume any click on the input area should try to show the picker.

            // event.preventDefault(); // Cautious about using this, it might prevent text selection or caret positioning.

            try {
                // 'this' refers to the dateInput element
                if (typeof this.showPicker === 'function') {
                    this.showPicker();
                }
            } catch (e) {
                console.warn("dateInput.showPicker() failed:", e);
            }
        });
    });
    console.log("Enhanced native date pickers with mousedown-to-open attempt.");
}


function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

function initFormDataSaving() {
    const form = document.querySelector('.search-section form');
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (input.type === 'date') {
            input.addEventListener('change', saveFormData);
        } else {
            input.addEventListener('input', saveFormData);
            input.addEventListener('change', saveFormData);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initDatePickers(); // Call this
    initThemeSwitcher();
    initClearButton();
    loadFormData();
    initFormDataSaving();
    registerServiceWorker();

    document.querySelectorAll('input:not([type="date"]), textarea').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (input.tagName !== 'TEXTAREA' || e.shiftKey === false) {
                    e.preventDefault();
                    const searchButton = document.querySelector('button.search-button');
                    if (searchButton) {
                        searchButton.click();
                    }
                }
            }
        });
    });
});