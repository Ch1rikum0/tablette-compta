
const tablet = document.getElementById('tablet');
const balanceEl = document.getElementById('balance');
const historyEl = document.getElementById('history');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const descriptionEl = document.getElementById('description');
const toastEl = document.getElementById('toast');

const STORAGE_KEY = 'tablette-compta-operations-v1';
let transactions = [];

function money(value) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

function notify(message, kind = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${kind}`;
    setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        transactions = saved ? JSON.parse(saved) : [];

        if (!Array.isArray(transactions)) transactions = [];
    } catch (error) {
        transactions = [];
        notify('Stockage indisponible : historique non chargé.', 'error');
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        notify('Impossible de sauvegarder les opérations.', 'error');
        return false;
    }
}

function renderData() {
    const balance = transactions.reduce((total, tx) => {
        return total + (tx.type === 'entree' ? tx.amount : -tx.amount);
    }, 0);

    balanceEl.textContent = money(balance);

    if (!transactions.length) {
        historyEl.innerHTML =
            '<tr><td colspan="5" class="empty">Aucune opération enregistrée.</td></tr>';
        return;
    }

    historyEl.innerHTML = transactions.map(tx => {
        const incoming = tx.type === 'entree';

        return `<tr>
            <td>${escapeHtml(tx.date)}</td>
            <td>${incoming ? 'Entrée' : 'Sortie'}</td>
            <td>${escapeHtml(tx.description)}</td>
            <td>Local</td>
            <td class="right ${incoming ? 'amount-in' : 'amount-out'}">
                ${incoming ? '+' : '−'} ${money(tx.amount)}
            </td>
        </tr>`;
    }).join('');
}

document.getElementById('submitBtn').addEventListener('click', () => {
    const amount = Number(amountEl.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        notify('Entre un montant supérieur à zéro.', 'error');
        return;
    }

    const operation = {
        type: typeEl.value,
        amount: Math.round(amount * 100) / 100,
        description: descriptionEl.value.trim(),
        date: new Date().toLocaleString('fr-FR')
    };

    transactions.unshift(operation);

    if (!saveTransactions()) {
        transactions.shift();
        return;
    }

    renderData();
    amountEl.value = '';
    descriptionEl.value = '';
    notify('Opération enregistrée localement.', 'success');
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    loadTransactions();
    renderData();
    notify('Historique actualisé.');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    tablet.classList.add('hidden');
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') tablet.classList.add('hidden');
});

window.addEventListener('message', event => {
    if (event.data?.action === 'open') {
        tablet.classList.remove('hidden');
    }

    if (event.data?.action === 'close') {
        tablet.classList.add('hidden');
    }
});

loadTransactions();
renderData();
