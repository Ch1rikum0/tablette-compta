console.log("Version JavaScript de la tablette chargée");

const SUPABASE_URL = "https://reqrvqliaakvptcpazkm.supabase.co";
const SUPABASE_KEY = "sb_publishable_YoXG0Gn6rftPxYZfrxS7wg_oNJzAPYf";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        db: {
            schema: 'public'
        }
    }
);

async function loadSharedBalance() {
    const { data, error } = await supabaseClient
        .from('compta')
        .select('id, solde')
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Erreur de lecture du solde :', error);
        notify('Impossible de charger le solde partagé.', 'error');
        return;
    }

    if (data) {
        currentBalance = Number(data.solde) || 0;
        renderData();
    }
}

async function loadSharedOperations() {
    const { data, error } = await supabaseClient
        .from('operations')
        .select('*')
        .eq('archivee', false)
        .order('date_operation', { ascending: false });

    if (error) {
        console.error('Erreur de lecture des opérations :', error);
        notify('Impossible de charger les opérations partagées.', 'error');
        return;
    }

    transactions = (data || []).map(op => ({
        id: op.id,
        type: op.type,
        amount: Number(op.montant) || 0,
        description: op.description || '',
        date: op.date_operation || '',
        player: op.joueur || 'Inconnu'
    }));

    renderData();
}

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
const BALANCE_KEY = 'tablette-compta-solde-v1';

let transactions = [];
let currentBalance = Number(localStorage.getItem(BALANCE_KEY)) || 0;

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
   balanceEl.textContent = money(currentBalance);

    if (!transactions.length) {
        historyEl.innerHTML =
            '<tr><td colspan="5" class="empty">Aucune opération enregistrée.</td></tr>';
        return;
    }

    historyEl.innerHTML = transactions.map(tx => {
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


document.getElementById('submitBtn').addEventListener('click', async () => {
    const amount = Number(amountEl.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        notify('Entre un montant supérieur à zéro.', 'error');
        return;
    }

    const button = document.getElementById('submitBtn');
    button.disabled = true;

    try {
        // 1. Lire le solde actuel partagé
        const { data: comptaRow, error: balanceError } =
            await supabaseClient
                .from('compta')
                .select('id, solde')
                .limit(1)
                .maybeSingle();

        if (balanceError) throw balanceError;

        if (!comptaRow) {
            throw new Error('Aucune ligne trouvée dans la table compta.');
        }

        const operation = {
            type: typeEl.value,
            montant: Math.round(amount * 100) / 100,
            description: descriptionEl.value.trim(),
            date_operation: new Date().toISOString(),
            joueur: 'Local',
            archivee: false
        };

        const ancienSolde = Number(comptaRow.solde) || 0;

        const nouveauSolde = ancienSolde +
            (operation.type === 'entree'
                ? operation.montant
                : -operation.montant);

        // 2. Enregistrer l'opération dans Supabase
        const { data: operationEnregistree, error: insertError } =
            await supabaseClient
                .from('operations')
                .insert([operation])
                .select()
                .single();

        if (insertError) throw insertError;

        // 3. Mettre à jour le solde partagé
        const { error: updateError } = await supabaseClient
            .from('compta')
            .update({
                solde: nouveauSolde,
                updated_at: new Date().toISOString()
            })
            .eq('id', comptaRow.id);

        if (updateError) {
            // Annuler l'opération si le solde n'a pas pu être mis à jour
            const { error: rollbackError } = await supabaseClient
                .from('operations')
                .delete()
                .eq('id', operationEnregistree.id);

            if (rollbackError) {
                console.error('Erreur lors de l’annulation :', rollbackError);
            }

            throw updateError;
        }

        // 4. Actualiser l'affichage
        currentBalance = nouveauSolde;

        transactions.unshift({
            id: operationEnregistree.id,
            type: operationEnregistree.type,
            amount: Number(operationEnregistree.montant) || 0,
            description: operationEnregistree.description || '',
            date: new Date(
                operationEnregistree.date_operation
            ).toLocaleString('fr-FR'),
            player: operationEnregistree.joueur || 'Local'
        });

        renderData();

        amountEl.value = '';
        descriptionEl.value = '';

        notify('Opération enregistrée dans Supabase.', 'success');

    } catch (error) {
        console.error('Erreur d’enregistrement :', error);
        notify('Erreur lors de l’enregistrement. Consulte la console.', 'error');

        // Recharger les données pour retrouver l'état du serveur
        await loadSharedBalance();
        await loadSharedOperations();

    } finally {
        button.disabled = false;
    }
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

        // Ajouter les opérations à l'historique archivé
        archives.push([...transactions]);
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));

        // Vider uniquement les opérations de l'historique actuel
        transactions = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    // Conserver le solde enregistré
    currentBalance = Number(localStorage.getItem(BALANCE_KEY)) || currentBalance;
    balanceEl.textContent = money(currentBalance);

    // Actualiser les deux historiques
    renderData();
    renderArchive();

    notify('Historique archivé. Solde conservé.');
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
loadSharedBalance();
loadSharedOperations();
