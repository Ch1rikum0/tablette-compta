console.log("Version JavaScript de la tablette chargée");

const tablet = document.getElementById('tablet');
const balanceEl = document.getElementById('balance');
const historyEl = document.getElementById('history');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const descriptionEl = document.getElementById('description');
const toastEl = document.getElementById('toast');

document.getElementById('closeBtn').style.display = 'none';

const STORAGE_KEY = 'tablette-compta-operations-v1';
const ARCHIVE_KEY = 'tablette-compta-archives-v1';
let transactions = [];

function money(value) {
    return `${Math.round(value).toLocaleString('fr-FR')} $`;
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
    
    
function renderArchive() {
    const archiveHistoryEl = document.getElementById('archiveHistory');

    if (!archiveHistoryEl) return;

    let archives = [];

    try {
        archives = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
    } catch (error) {
        archives = [];
    }

    if (!Array.isArray(archives) || archives.length === 0) {
        archiveHistoryEl.innerHTML =
            '<tr><td colspan="5" class="empty">Aucune opération archivée.</td></tr>';
        return;
    }

    archiveHistoryEl.innerHTML = archives.flat().map(tx => {
        const incoming = tx.type === 'entree';

        return `<tr>
            <td>${escapeHtml(tx.date || '')}</td>
            <td>${incoming ? 'Entrée' : 'Sortie'}</td>
            <td>${escapeHtml(tx.description || '')}</td>
            <td>Local</td>
            <td class="right ${incoming ? 'amount-in' : 'amount-out'}">
                ${incoming ? '+' : '−'} ${money(tx.amount)}
            </td>
        </tr>`;
    }).join('');
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
    if (transactions.length > 0) {
        let archives = [];

        try {
            archives = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
        } catch (error) {
            archives = [];
        }

        if (!Array.isArray(archives)) archives = [];

        archives.push([...transactions]);

        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));
        transactions = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    loadTransactions();
    renderData();
    renderArchive();

    notify('Historique actualisé et opérations archivées.');
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

if (window.location.hostname === 'ch1rikum0.github.io') {
    tablet.classList.remove('hidden');
}

const navButtons = document.querySelectorAll('.nav-btn');

const pages = {
    compta: document.getElementById('page-compta'),
    rachat: document.getElementById('page-rachat'),
    drogue: document.getElementById('page-drogue'),
    historique: document.getElementById('page-historique')
};

const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const pageIcon = document.getElementById('pageIcon');

const pageInfo = {
    compta: {
        title: 'Comptabilité',
        subtitle: "Tableau de gestion de l'entreprise",
        icon: '🏦'
    },
    rachat: {
        title: "Rachat d'objet",
        subtitle: "Gestion des rachats d'objets",
        icon: '📦'
    },
    drogue: {
        title: 'Drogue',
        subtitle: "Gestion de l'activite drogue",
        icon: '🌿'
    },
     historique: {
        title: 'Historique',
        subtitle: 'Historique des opérations comptables',
        icon: '📜'
    }
};

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const selectedPage = button.dataset.page;

        // Fermer toutes les pages
        Object.values(pages).forEach(page => {
            if (page) page.classList.remove('active');
        });

        // Ouvrir uniquement la page choisie
        if (pages[selectedPage]) {
            pages[selectedPage].classList.add('active');
        }

        // Mettre à jour le menu
        navButtons.forEach(btn => {
            btn.classList.remove('active');
        });

        button.classList.add('active');

        // Mettre à jour le titre
       if (pageInfo[selectedPage]) {
    pageTitle.textContent = pageInfo[selectedPage].title;
    pageSubtitle.textContent = pageInfo[selectedPage].subtitle;
    pageIcon.textContent = pageInfo[selectedPage].icon;
}
    });
});



loadTransactions();
renderData();
