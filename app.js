console.log("Version JavaScript de la tablette chargée");

const SUPABASE_URL = "https://reqrvqliaakvptcpazkm.supabase.co";
const SUPABASE_KEY = "sb_publishable_YoXG0Gn6rftPxYZfrxS7wg_oNJzAPYf";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    { db: { schema: 'public' } }
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
        date: op.date_operation
            ? new Date(op.date_operation).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '').replace(':', 'h')
            : '',
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
let currentBalance = 0;

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

async function renderArchive() {
    const archiveHistoryEl = document.getElementById('archiveHistory');
    if (!archiveHistoryEl) return;

    archiveHistoryEl.innerHTML =
        '<tr><td colspan="5" class="empty">Chargement de l’historique...</td></tr>';

    const { data, error } = await supabaseClient
        .from('operations')
        .select('*')
        .eq('archivee', true)
        .order('date_operation', { ascending: false });

    if (error) {
        console.error('Erreur de chargement des archives :', error);
        archiveHistoryEl.innerHTML =
            '<tr><td colspan="5" class="empty">Impossible de charger l’historique.</td></tr>';
        return;
    }

    let archives = [];

    try {
        archives = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || [];
    } catch (e) {
        archives = [];
    }

    const sharedArchives = (data || []).map(op => ({
        id: op.id,
        type: op.type,
        amount: Number(op.montant) || 0,
        description: op.description || '',
        date: op.date_operation
            ? new Date(op.date_operation).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '').replace(':', 'h')
            : '',
        player: op.joueur || 'Inconnu'
    }));

    const allArchives = [
        ...sharedArchives,
        ...archives.flat()
    ];

    if (allArchives.length === 0) {
        archiveHistoryEl.innerHTML =
            '<tr><td colspan="5" class="empty">Aucune opération archivée.</td></tr>';
        return;
    }

    archiveHistoryEl.innerHTML = allArchives.map(tx => {
        const incoming = tx.type === 'entree';

        return `<tr>
            <td>${escapeHtml(tx.date || '')}</td>
            <td><span class="type-pill ${incoming ? 'in' : 'out'}">${incoming ? 'Entrée' : 'Sortie'}</span></td>
            <td>${escapeHtml(tx.description || '')}</td>
            <td>${escapeHtml(tx.player || 'Inconnu')}</td>
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

document.getElementById('refreshBtn').addEventListener('click', async () => {
    if (transactions.length === 0) {
        notify('Aucune opération à archiver.', 'error');
        return;
    }

    const operationIds = transactions
        .map(tx => tx.id)
        .filter(id => id !== undefined && id !== null);

    if (operationIds.length === 0) {
        notify('Impossible de retrouver les opérations dans Supabase.', 'error');
        return;
    }

 const { error } = await supabaseClient
    .from('operations')
    .update({ archivee: true })
    .in('id', operationIds);

if (error) {
    console.error('Erreur lors de l’archivage :', error);
    notify('Impossible d’archiver les opérations.', 'error');
    return;
}

    transactions = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));

    balanceEl.textContent = money(currentBalance);
    renderData();
    renderArchive();

    notify('Historique archivé. Solde conservé.', 'success');

    await loadSharedOperations();
    await renderArchive();
});

const clearArchiveBtn = document.getElementById('clearArchiveBtn');
console.log("Bouton historique :", clearArchiveBtn);
const confirmArchive = document.getElementById('confirmArchive');
const cancelClearArchive = document.getElementById('cancelClearArchive');
const confirmClearArchive = document.getElementById('confirmClearArchive');

if (clearArchiveBtn && confirmArchive) {
    clearArchiveBtn.addEventListener('click', () => {
        confirmArchive.classList.remove('hidden');
    });
}

if (cancelClearArchive && confirmArchive) {
    cancelClearArchive.addEventListener('click', () => {
        confirmArchive.classList.add('hidden');
    });
}

if (confirmClearArchive && confirmArchive) {
    confirmClearArchive.addEventListener('click', async () => {
        confirmClearArchive.disabled = true;

        try {
            // Supprimer les opérations archivées dans Supabase
            const { error } = await supabaseClient
                .from('operations')
                .delete()
                .eq('archivee', true);

            if (error) {
                console.error('Erreur de suppression Supabase :', error);
                notify('Impossible de supprimer l’historique partagé.', 'error');
                return;
            }

            // Supprimer aussi les archives locales
            localStorage.removeItem(ARCHIVE_KEY);

            // Actualiser l'affichage
            await renderArchive();

            confirmArchive.classList.add('hidden');
            notify('Historique supprimé définitivement.', 'success');
        } catch (error) {
            console.error('Erreur lors de la suppression :', error);
            notify('Impossible de supprimer l’historique.', 'error');
        } finally {
            confirmClearArchive.disabled = false;
        }
    });
}

console.log('Clic sur Vider l’historique détecté');
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
    historique: document.getElementById('page-historique'),
    detteCell: document.getElementById('page-dette-cell')
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

        // Masquer toutes les pages, y compris Dette
document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
});

// Afficher uniquement la page sélectionnée
if (pages[selectedPage]) {
    pages[selectedPage].classList.add('active');
}
        
        // Mettre à jour le titre
      if (pageInfo[selectedPage]) {
    pageTitle.textContent = pageInfo[selectedPage].title;
    pageSubtitle.textContent = pageInfo[selectedPage].subtitle;
    pageIcon.textContent = pageInfo[selectedPage].icon;
}

updateDetteButtonVisibility();
    });
});

const openDetteCell = document.getElementById('openDetteCell');
const backCompta = document.getElementById('backCompta');
const pageDetteCell = document.getElementById('page-dette-cell');


openDetteCell.addEventListener('click', () => {
    console.log("Ouverture Dette : clic détecté");
    console.log("Conteneur :", document.querySelector('.main-content'));
    document.querySelector('.main-content').classList.add('dette-ouverte');
    Object.values(pages).forEach(page => {
        if (page) page.classList.remove('active');
    });

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    pageDetteCell.classList.add('active');

    pageTitle.textContent = 'Dette';
    pageSubtitle.textContent = 'Gestion des dettes';
    pageIcon.textContent = '💰';

    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    const backButton = document.getElementById('backCompta');

    if (backButton) {
        backButton.style.display = 'block';
    }

    updateDetteButtonVisibility();
});


backCompta.addEventListener('click', () => {
    document.querySelector('.main-content').classList.remove('dette-ouverte');
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    pages.compta.classList.add('active');

    pageTitle.textContent = pageInfo.compta.title;
    pageSubtitle.textContent = pageInfo.compta.subtitle;
    pageIcon.textContent = pageInfo.compta.icon;

    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === 'compta');
    });

    updateDetteButtonVisibility();
});

loadTransactions();
renderData();

async function initializeTablet() {
    await loadSharedBalance();
    await loadSharedOperations();
    await renderArchive();
}

initializeTablet();


/* Navigation entre les fonds d'écran en plein écran */
(() => {
    const openButton = document.getElementById('openTokyo');
    const closeButton = document.getElementById('closeTokyo');
    const fullscreen = document.getElementById('tokyoFullscreen');
    const image = document.getElementById('fullscreenImage');
    const title = document.getElementById('fullscreenTitle');
    const prevButton = document.getElementById('prevTokyo');
    const nextButton = document.getElementById('nextTokyo');

    if (!openButton || !closeButton || !fullscreen || !image ||
        !title || !prevButton || !nextButton) return;

    const wallpapers = [
        {
            src: '/tablette-compta/tokyo-ghoul.png',
            alt: 'Fond d’écran Tokyo Ghoul',
            title: '👻 SILENT GHOST — KANEKI KEN'
        },
        {
            src: '/tablette-compta/limule-tempest.png',
            alt: 'Fond d’écran Limule Tempest',
            title: '👻 SILENT GHOST — LIMULE TEMPEST'
        }
    ];

    let currentIndex = 0;

    function showWallpaper(index) {
        currentIndex = (index + wallpapers.length) % wallpapers.length;
        const wallpaper = wallpapers[currentIndex];

        image.src = wallpaper.src;
        image.alt = wallpaper.alt;
        title.textContent = wallpaper.title;
    }

    openButton.addEventListener('click', () => {
        const slides = document.querySelectorAll('.tokyo-slide');
        let selectedIndex = 0;

        slides.forEach((slide, index) => {
            if (slide.classList.contains('active')) {
                selectedIndex = index;
            }
        });

        showWallpaper(selectedIndex);
        fullscreen.classList.remove('hidden');
        fullscreen.style.position = 'fixed';
        fullscreen.style.inset = '0';
        fullscreen.style.width = '100%';
        fullscreen.style.height = '100%';
        fullscreen.style.zIndex = '99999';
    });

    prevButton.addEventListener('click', () => {
        showWallpaper(currentIndex - 1);
    });

    nextButton.addEventListener('click', () => {
        showWallpaper(currentIndex + 1);
    });

    closeButton.addEventListener('click', () => {
        fullscreen.classList.add('hidden');
    });

    document.addEventListener('keydown', (event) => {
        if (fullscreen.classList.contains('hidden')) return;

        if (event.key === 'ArrowLeft') {
            showWallpaper(currentIndex - 1);
        } else if (event.key === 'ArrowRight') {
            showWallpaper(currentIndex + 1);
        } else if (event.key === 'Escape') {
            fullscreen.classList.add('hidden');
        }
    });
})();


/* ===== DIAPORAMA AUTOMATIQUE ===== */
(() => {
    function startTokyoSlideshow() {
        const container = document.querySelector('.tokyo-content');
        if (!container) return;

        const slides = Array.from(
    document.querySelectorAll('.tokyo-content .tokyo-slide')
);

        if (slides.length < 2) {
            console.warn('Diaporama : il faut au moins 2 diapositives.');
            return;
        }

        let index = slides.findIndex(slide =>
            slide.classList.contains('active')
        );

        if (index < 0) index = 0;

        function showSlide(n) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === n);
            });
        }

        showSlide(index);

        window.tokyoSlideshowTimer =
            window.setInterval(() => {
                index = (index + 1) % slides.length;
                showSlide(index);
            }, 5000);

        console.log('Diaporama lancé : changement toutes les 5 secondes.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            startTokyoSlideshow,
            { once: true }
        );
    } else {
        startTokyoSlideshow();
    }
})();


/* ================================
   GESTION DES DETTES
================================ */

const debtForm = document.getElementById('debtForm');
const debtPlayer = document.getElementById('debtPlayer');
const debtDirection = document.getElementById('debtDirection');
const debtAmount = document.getElementById('debtAmount');
const debtReason = document.getElementById('debtReason');
const debtSearch = document.getElementById('debtSearch');
const debtFilter = document.getElementById('debtFilter');
const debtList = document.getElementById('debtList');

const debtToReceive = document.getElementById('debtToReceive');
const debtToPay = document.getElementById('debtToPay');
const debtCount = document.getElementById('debtCount');


const DEBT_STORAGE_KEY = 'tabletteComptaDebts';

let debts = [];
let debtsLoadedFromServer = false;

try {
    debts = JSON.parse(localStorage.getItem(DEBT_STORAGE_KEY)) || [];
    if (!Array.isArray(debts)) debts = [];
} catch (error) {
    debts = [];
}


function formatDebtAmount(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} $`;
}

function saveDebts() {
    localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts));

    // Ne rien envoyer au serveur avant le chargement initial.
    if (!debtsLoadedFromServer) return;

    const sharedDebts = debts.map(debt => ({
        id: String(debt.id),
        joueur: debt.player,
        direction: debt.direction,
        montant: debt.amount,
        reste: debt.remaining,
        motif: debt.reason,
        remboursements: debt.repayments || [],
        soldee: debt.remaining <= 0,
        cree_le: debt.createdAt || new Date().toISOString()
    }));

    if (sharedDebts.length === 0) return;

    supabaseClient
        .from('dettes')
        .upsert(sharedDebts, { onConflict: 'id' })
        .then(({ error }) => {
            if (error) {
                console.error('Erreur de sauvegarde des dettes :', error);
            }
        });
}



function renderDebts() {
    if (!debtList) return;

    const search = debtSearch.value.trim().toLowerCase();
    const filter = debtFilter.value;

    const filteredDebts = debts.filter(debt => {
        const matchesSearch =
            debt.player.toLowerCase().includes(search) ||
            debt.reason.toLowerCase().includes(search);

   
const matchesFilter =
    (filter === 'all' && debt.remaining > 0) ||
    (filter === 'receive' && debt.direction === 'receive' && debt.remaining > 0) ||
    (filter === 'pay' && debt.direction === 'pay' && debt.remaining > 0) ||
    (filter === 'open' && debt.remaining > 0) ||
    (filter === 'paid' && debt.remaining <= 0);


        return matchesSearch && matchesFilter;
    });

   
debtList.innerHTML = '';

const header = document.createElement('div');
header.className = 'debt-table-header';

header.innerHTML = `
    <span>Nom</span>
    <span>Motif</span>
    <span>Silent Ghost</span>
    <span>Montant</span>
    <span>Reste à payer</span>
    <span>Statut</span>
`;

debtList.appendChild(header);

if (filteredDebts.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'muted';
    emptyMessage.textContent = 'Aucune dette trouvée.';
    debtList.appendChild(emptyMessage);
}


    filteredDebts.forEach(debt => {
        // Compatibilité avec les dettes déjà enregistrées
        if (typeof debt.remaining !== 'number') {
            debt.remaining = debt.paid ? 0 : debt.amount;
        }

       const card = document.createElement('article');
        card.className = 'debt-item';
        
        const debtToggle = document.createElement('button');
        debtToggle.type = 'button';
        debtToggle.className = 'debt-card-toggle';
        debtToggle.innerHTML = `
            <span>Dette de ${debt.player}</span>
            <span class="debt-card-arrow">▼</span>
        `;
        
       const debtContent = document.createElement('div');
       debtContent.className = 'debt-card-content';
       debtContent.style.setProperty('display', 'none', 'important');
       
        const title = document.createElement('span');
        title.className = 'debt-cell debt-name';
        title.textContent = debt.player;

        const reason = document.createElement('span');
        reason.className = 'debt-cell';
        reason.textContent = debt.reason;

        const direction = document.createElement('span');
        direction.className = 'debt-cell';
        direction.textContent = debt.direction === 'receive'
            ? 'Dette'
            : 'Remboursement';

        const originalAmount = document.createElement('span');
        originalAmount.className = 'debt-cell';
        originalAmount.textContent = `${formatDebtAmount(debt.amount)}`;

        const remainingAmount = document.createElement('span');
        remainingAmount.className = 'debt-cell';
        remainingAmount.textContent = `${formatDebtAmount(debt.remaining)}`;

        const status = document.createElement('span');
        status.className = 'debt-cell debt-status';
        status.textContent = debt.remaining <= 0
            ? 'Soldée'
            : debt.remaining < debt.amount
                ? 'Remboursement partiel'
                : 'En cours';

        const details = document.createElement('div');
        details.className = 'debt-actions';

        if (debt.remaining > 0) {
            const repaymentInput = document.createElement('input');
            repaymentInput.type = 'number';
            repaymentInput.min = '1';
            repaymentInput.max = String(debt.remaining);
            repaymentInput.step = '1';
            repaymentInput.placeholder = 'Montant du remboursement';
            repaymentInput.setAttribute(
                'aria-label',
                'Montant du remboursement'
            );

            const repaymentButton = document.createElement('button');
            repaymentButton.type = 'button';
            repaymentButton.className = 'secondary-btn';
            repaymentButton.textContent = 'Enregistrer le remboursement';


repaymentButton.addEventListener('click', async () => {
    const repayment = Number(repaymentInput.value);

    if (
        !Number.isFinite(repayment) ||
        repayment <= 0 ||
        repayment > debt.remaining
    ) {
        alert(`Entre un montant entre 1 et ${debt.remaining} $.`);
        return;
    }

    repaymentButton.disabled = true;

    try {
        // 1. Lire le solde partagé
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

        // 2. Déterminer le sens de l'opération
        // receive : le joueur rembourse les Silent Ghost -> entrée
        // pay : les Silent Ghost remboursent le joueur -> sortie
        const typeOperation =
            debt.direction === 'receive' ? 'entree' : 'sortie';

        const montant = Math.round(repayment * 100) / 100;
        const ancienSolde = Number(comptaRow.solde) || 0;

        const nouveauSolde = ancienSolde +
            (typeOperation === 'entree' ? montant : -montant);

        const operation = {
            type: typeOperation,
            montant: montant,
            description: `Remboursement dette - ${debt.player} - ${debt.reason || ''}`,
            date_operation: new Date().toISOString(),
            joueur: debt.player || 'Local',
            archivee: false
        };

        // 3. Enregistrer l'opération comptable
        const { data: operationEnregistree, error: insertError } =
            await supabaseClient
                .from('operations')
                .insert([operation])
                .select()
                .single();

        if (insertError) throw insertError;

        // 4. Mettre à jour le solde partagé
        const { error: updateError } = await supabaseClient
            .from('compta')
            .update({
                solde: nouveauSolde,
                updated_at: new Date().toISOString()
            })
            .eq('id', comptaRow.id);

        if (updateError) {
            const { error: rollbackError } = await supabaseClient
                .from('operations')
                .delete()
                .eq('id', operationEnregistree.id);

            if (rollbackError) {
                console.error('Erreur lors de l’annulation :', rollbackError);
            }

            throw updateError;
        }

        // 5. Mettre à jour la dette après confirmation comptable
        debt.remaining = Math.max(0, debt.remaining - montant);

        if (debt.remaining < 0.001) {
            debt.remaining = 0;
        }

        debt.paid = debt.remaining === 0;

        if (!Array.isArray(debt.repayments)) {
            debt.repayments = [];
        }

        debt.repayments.push({
            amount: montant,
            date: new Date().toISOString()
        });

        // 6. Actualiser le solde local et l'affichage
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

        saveTransactions();
        renderData();

        // 7. Sauvegarder la dette et actualiser les données
        saveDebts();
        renderDebts();

        notify('Remboursement enregistré en comptabilité.', 'success');

    } catch (error) {
        console.error('Erreur lors du remboursement :', error);

        notify(
            'Erreur lors du remboursement. Consulte la console.',
            'error'
        );

        await loadSharedBalance();
        await loadSharedOperations();

    } finally {
        repaymentButton.disabled = false;
    }
});


            details.append(repaymentInput, repaymentButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'secondary-btn';
        deleteButton.textContent = 'Supprimer';




deleteButton.addEventListener('click', async () => {
    // Créer la fenêtre de confirmation
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        padding: 20px;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #151e30;
        color: #f3f6fc;
        padding: 25px;
        border-radius: 14px;
        width: 100%;
        max-width: 380px;
        text-align: center;
        border: 1px solid #29364c;
        box-shadow: 0 15px 40px rgba(0,0,0,0.4);
    `;

    const message = document.createElement('p');
    message.textContent = `Voulez-vous vraiment supprimer la dette de ${debt.player} ?`;
    message.style.cssText = `
        margin: 0 0 22px;
        font-size: 16px;
        line-height: 1.5;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 12px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Annuler';

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = 'Supprimer';

    cancelButton.style.cssText = `
        padding: 10px 16px;
        border: 0;
        border-radius: 8px;
        background: #29364c;
        color: white;
        cursor: pointer;
    `;

    confirmButton.style.cssText = `
        padding: 10px 16px;
        border: 0;
        border-radius: 8px;
        background: #e5484d;
        color: white;
        cursor: pointer;
    `;

    actions.append(cancelButton, confirmButton);
    modal.append(message, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    cancelButton.addEventListener('click', () => {
        overlay.remove();
    });

    confirmButton.addEventListener('click', async () => {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Suppression...';

        try {
            const { data, error } = await supabaseClient
                .from('dettes')
                .delete()
                .eq('id', String(debt.id))
                .select('id');

            if (error) throw error;

            if (!data || data.length === 0) {
                notify('La dette n’a pas été supprimée.', 'error');
                overlay.remove();
                return;
            }

            debts = debts.filter(
                item => String(item.id) !== String(debt.id)
            );

            localStorage.setItem(
                DEBT_STORAGE_KEY,
                JSON.stringify(debts)
            );

            overlay.remove();
            renderDebts();
            notify('Dette supprimée.', 'success');

        } catch (error) {
            console.error('Erreur de suppression :', error);
            overlay.remove();
            notify('Erreur lors de la suppression.', 'error');
        }
    });
});




        details.appendChild(deleteButton);

        const columns = document.createElement('div');
        columns.className = 'debt-table-row';
        columns.append(
            title,
            reason,
            direction,
            originalAmount,
            remainingAmount,
            status
        );

       debtContent.append(columns, details);

debtToggle.addEventListener('click', () => {
    const isOpen = debtContent.style.display !== 'none';

   debtContent.style.setProperty(
    'display',
    isOpen ? 'none' : 'block',
    'important'
);
    
    const arrow = debtToggle.querySelector('.debt-card-arrow');
    arrow.textContent = isOpen ? '▶' : '▼';
});

card.append(debtToggle, debtContent);
debtList.appendChild(card);
    });
        
    // Mise à jour des totaux : seules les sommes restantes sont comptées
    const openDebts = debts.filter(debt => {
        if (typeof debt.remaining !== 'number') {
            debt.remaining = debt.paid ? 0 : debt.amount;
        }

        return debt.remaining > 0;
    });

    const totalReceive = openDebts
        .filter(debt => debt.direction === 'receive')
        .reduce((total, debt) => total + debt.remaining, 0);

    const totalPay = openDebts
        .filter(debt => debt.direction === 'pay')
        .reduce((total, debt) => total + debt.remaining, 0);

    debtToReceive.textContent = formatDebtAmount(totalReceive);
    debtToPay.textContent = formatDebtAmount(totalPay);
    debtCount.textContent = openDebts.length;

    saveDebts();
}


if (debtForm) {
    debtForm.addEventListener('submit', event => {
        event.preventDefault();

        const player = debtPlayer.value.trim();
        const direction = debtDirection.value;
        const amount = Number(debtAmount.value);
        const reason = debtReason.value.trim();

        if (!player || !reason || !Number.isFinite(amount) || amount <= 0) {
            alert('Vérifie le nom, le motif et le montant de la dette.');
            return;
        }

        debts.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            player,
            direction,
            amount,
            remaining: amount,
            repayments: [],
            reason,
            paid: false,
            createdAt: new Date().toISOString()
        });

        saveDebts();
        debtForm.reset();
        renderDebts();
    });
}

if (debtSearch) {
    debtSearch.addEventListener('input', renderDebts);
}

if (debtFilter) {
    debtFilter.addEventListener('change', renderDebts);
}

async function loadSharedDebts() {
    const localDebts = Array.isArray(debts) ? [...debts] : [];

    const { data, error } = await supabaseClient
        .from('dettes')
        .select('*')
        .order('cree_le', { ascending: true });

    if (error) {
        console.error('Erreur de chargement des dettes :', error);
        renderDebts();
        return;
    }

    const remoteDebts = (data || []).map(row => ({
        id: String(row.id),
        player: row.joueur,
        direction: row.direction,
        amount: Number(row.montant),
        remaining: Number(row.reste),
        reason: row.motif,
        repayments: row.remboursements || [],
        paid: row.soldee,
        createdAt: row.cree_le
    }));

    const migrationKey = 'tabletteComptaDebtsMigrated';
    const alreadyMigrated = localStorage.getItem(migrationKey) === 'true';

    if (!alreadyMigrated) {
        const remoteIds = new Set(
            remoteDebts.map(debt => String(debt.id))
        );

        const oldLocalDebts = localDebts.filter(
            debt => !remoteIds.has(String(debt.id))
        );

        debts = [...remoteDebts, ...oldLocalDebts];

        localStorage.setItem(migrationKey, 'true');
        debtsLoadedFromServer = true;

        saveDebts();
    } else {
        debts = remoteDebts;
        debtsLoadedFromServer = true;

        localStorage.setItem(
            DEBT_STORAGE_KEY,
            JSON.stringify(debts)
        );
    }

    renderDebts();
}

loadSharedDebts();


let debtRealtimeChannel = null;

function subscribeToDebtChanges() {
    if (debtRealtimeChannel) {
        supabaseClient.removeChannel(debtRealtimeChannel);
    }

    debtRealtimeChannel = supabaseClient
        .channel('shared-debts-realtime')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'dettes'
            },
            async () => {
                await loadSharedDebts();
            }
        )
        .subscribe((status) => {
            console.log('Synchronisation des dettes :', status);
        });
}

subscribeToDebtChanges();

function toggleDebtSection(sectionId, title) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const isOpen = section.style.display !== 'none';

    section.style.display = isOpen ? 'none' : 'block';

    const arrow = title.querySelector('.debt-arrow');
    if (arrow) {
        arrow.textContent = isOpen ? '▶' : '▼';
    }
}




function updateDetteButtonVisibility() {
    const detteButton = document.getElementById('openDetteCell');
    const backButton = document.getElementById('backCompta');
    const comptaPage = document.getElementById('page-compta');
    const dettePage = document.getElementById('page-dette-cell');

    if (detteButton && comptaPage) {
        detteButton.style.display =
            comptaPage.classList.contains('active') ? '' : 'none';
    }

    if (backButton && dettePage) {
        backButton.style.display =
            dettePage.classList.contains('active') ? 'block' : 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDetteButtonVisibility);
} else {
    updateDetteButtonVisibility();
}


/* =================================
   GESTION DU STOCK - PAGE DROGUE
================================= */

(() => {
    const stockForm = document.getElementById('stockForm');
    const stockTableBody = document.getElementById('stockTableBody');

    const stockProductCount = document.getElementById('stockProductCount');
    const stockQuantityTotal = document.getElementById('stockQuantityTotal');
    const stockValueTotal = document.getElementById('stockValueTotal');

    const stockName = document.getElementById('stockName');
    const stockCategory = document.getElementById('stockCategory');
    const stockImage = document.getElementById('stockImage');
    const stockCards = document.getElementById('stockCards');
    const stockQuantity = document.getElementById('stockQuantity');
    const stockUnitPrice = document.getElementById('stockUnitPrice');

    const STOCK_STORAGE_KEY = 'silent-ghost-stock-v1';

    // Arrêter proprement si le formulaire HTML n'est pas présent.
    if (
        !stockForm ||
        (!stockCards && !stockTableBody) ||
        !stockProductCount ||
        !stockQuantityTotal ||
        !stockValueTotal
    ) {
        return;
    }

    let stockItems = [];

  
async function loadStock() {
    try {
        const { data, error } = await supabaseClient
            .from('stock')
            .select('*');

        if (error) {
            throw error;
        }

        stockItems = (data || []).map(item => ({
            id: item.id,
            name: item.nom,
            category: item.categorie,
            image: item.image || '',
            quantity: Number(item.quantite) || 0,
            unitPrice: Number(item.prix_unitaire) || 0
        }));

        renderStock();
    } catch (error) {
        console.error('Erreur de chargement du stock :', error);

        if (typeof notify === 'function') {
            notify('Impossible de charger le stock partagé.', 'error');
        }
    }
}


async function saveStock() {
    try {
        for (const item of stockItems) {
            const row = {
                id: String(item.id),
                nom: item.name,
                categorie: item.category,
                image: item.image || '',
                quantite: Number(item.quantity) || 0,
                prix_unitaire: Number(item.unitPrice) || 0
            };

           const { error } = await supabaseClient
                .from('stock')
                .upsert(row, { onConflict: 'id' });
            
            if (error) {
                throw error;
            }
        }

        return true;
    } catch (error) {
        console.error('Erreur de sauvegarde du stock :', error);

        if (typeof notify === 'function') {
            notify('Impossible de sauvegarder le stock partagé.', 'error');
        }

        return false;
    }
}

function stockMoney(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} $`;
}
    
function renderStock() {
    console.log("stockMoney dans renderStock :", typeof stockMoney);

    let totalQuantity = 0;
    let totalValue = 0;

    stockItems.forEach(item => {
        totalQuantity += Number(item.quantity) || 0;
        totalValue +=
            (Number(item.quantity) || 0) *
            (Number(item.unitPrice) || 0);
    });

    stockProductCount.textContent = stockItems.length;
    stockQuantityTotal.textContent =
        totalQuantity.toLocaleString('fr-FR');
    stockValueTotal.textContent = stockMoney(totalValue);

    if (!stockCards) return;

    if (stockItems.length === 0) {
        stockCards.innerHTML =
            '<p class="muted">Aucun produit dans le stock.</p>';
        return;
    }

    stockCards.innerHTML = stockItems.map(item => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const total = quantity * unitPrice;
        const imageUrl = String(item.image || '').trim();

        const imageHtml = imageUrl
            ? `<img class="stock-product-image"
                    src="${escapeHtml(imageUrl)}"
                    alt="${escapeHtml(item.name)}"
                    onerror="this.style.display='none'">`
            : '<div class="stock-product-placeholder">📦</div>';

        return `
            <article class="stock-product-card">
                <div class="stock-product-visual">
                    ${imageHtml}
                </div>

                <div class="stock-product-info">
                    <div class="stock-product-heading">
                        <h4>${escapeHtml(item.name)}</h4>
                        <strong>${stockMoney(total)}</strong>
                    </div>

                    <span class="stock-product-category">
                        ${escapeHtml(item.category)}
                    </span>

                    <div class="stock-product-details">
                        <span>Quantité : ${quantity}</span>
                        <span>Unitaire : ${stockMoney(unitPrice)}</span>
                    </div>

                    <div class="stock-product-actions">
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value="${quantity}"
                            aria-label="Nouvelle quantité pour ${escapeHtml(item.name)}"
                            data-stock-quantity="${escapeHtml(item.id)}"
                        >

                        <button
                            type="button"
                            class="primary-btn"
                            data-stock-update="${escapeHtml(item.id)}"
                        >
                            Mettre à jour
                        </button>
                    </div>

<button
    type="button"
    class="secondary-btn objet-edit-btn"
    data-objet-edit="${escapeHtml(item.id)}"
>
    Modifier les informations
</button>

                    <button
                        type="button"
                        class="secondary-btn stock-delete-btn"
                        data-stock-delete="${escapeHtml(item.id)}"
                    >
                        Supprimer
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

    stockForm.addEventListener('submit', async event => {
        event.preventDefault();

        const name = stockName.value.trim();
        const category = stockCategory.value.trim();
        const image = stockImage ? stockImage.value.trim() : '';
        const quantity = Number(stockQuantity.value);
        const unitPrice = Number(stockUnitPrice.value);

        if (
            !name ||
            !category ||
            stockQuantity.value.trim() === '' ||
            stockUnitPrice.value.trim() === '' ||
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitPrice) ||
            quantity < 0 ||
            unitPrice < 0
        ) {
            if (typeof notify === 'function') {
                notify('Vérifie les informations du produit.', 'error');
            } else {
                alert('Vérifie les informations du produit.');
            }
            return;
        }

        if (!Number.isInteger(quantity)) {
            alert('La quantité doit être un nombre entier.');
            return;
        }

       stockItems.push({
    id: String(Date.now()) + '-' +
        Math.random().toString(16).slice(2),
    name: name,
    category: category,
    image: image,
    quantity: quantity,
    unitPrice: unitPrice
});

        if (!(await saveStock())) {
            stockItems.pop();
            renderStock();
            return;
        }

        renderStock();
        stockForm.reset();

        if (stockImage) stockImage.value = '';

        if (typeof notify === 'function') {
            notify('Produit ajouté au stock.', 'success');
        }
    });

    
const stockActionContainer = stockCards || stockTableBody;


stockActionContainer.addEventListener('click', async event => {
    const updateButton = event.target.closest('[data-stock-update]');

    if (updateButton) {
        const id = updateButton.getAttribute('data-stock-update');
        const quantityInput = stockActionContainer.querySelector(
            '[data-stock-quantity="' + id + '"]'
        );

        if (!quantityInput) return;

        const quantity = Number(quantityInput.value);

        if (
            quantityInput.value.trim() === '' ||
            !Number.isInteger(quantity) ||
            quantity < 0
        ) {
            alert('Entre une quantité entière supérieure ou égale à zéro.');
            return;
        }

        const item = stockItems.find(product => product.id === id);
        if (!item) return;

        const previousQuantity = item.quantity;
        item.quantity = quantity;

       if (!(await saveStock())) {
            item.quantity = previousQuantity;
            renderStock();
            return;
        }
        renderStock();

        if (typeof notify === 'function') {
            notify('Quantité mise à jour.', 'success');
        }

        return;
    }

    const deleteButton = event.target.closest('[data-stock-delete]');
    if (!deleteButton) return;

    const id = deleteButton.getAttribute('data-stock-delete');
    const itemToDelete = stockItems.find(item => item.id === id);

    if (!itemToDelete) return;

    if (!window.confirm(
        'Veux-tu vraiment supprimer le produit "' +
        itemToDelete.name +
        '" du stock ?'
    )) {
        return;
    }

   
const previousItems = stockItems.slice();

stockItems = stockItems.filter(item => item.id !== id);

try {
    const { error } = await supabaseClient
    .from('stock')
    .delete()
    .eq('id', id);
    
    if (error) {
        throw error;
    }
} catch (error) {
    console.error('Erreur de suppression du stock :', error);

    stockItems = previousItems;
    renderStock();

    if (typeof notify === 'function') {
        notify('Impossible de supprimer le produit partagé.', 'error');
    }

    return;
}

    renderStock();

    if (typeof notify === 'function') {
        notify('Produit supprimé du stock.', 'success');
    }
});
   
loadStock();
})();


/* =================================
   GESTION DES OBJETS
================================= */

(() => {
    const objetForm = document.getElementById('objetForm');
    const objetCards = document.getElementById('objetCards');

    const objetProductCount = document.getElementById('objetProductCount');
    const objetQuantityTotal = document.getElementById('objetQuantityTotal');
    const objetValueTotal = document.getElementById('objetValueTotal');

    const objetName = document.getElementById('objetName');
    const objetCategory = document.getElementById('objetCategory');
    const objetImage = document.getElementById('objetImage');
    const objetQuantity = document.getElementById('objetQuantity');
    const objetUnitPrice = document.getElementById('objetUnitPrice');

    if (
        !objetForm ||
        !objetCards ||
        !objetProductCount ||
        !objetQuantityTotal ||
        !objetValueTotal
    ) {
        return;
    }

    let objets = [];

    function objetMoney(value) {
        return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} $`;
    }
 
async function loadObjets() {
    try {
        const { data, error } = await supabaseClient
            .from('objets')
            .select('*')
            .order('nom', { ascending: true });

        if (error) throw error;

        console.log("Objets reçus de Supabase :", data);

        objets = (data || []).map(item => ({
            id: item.id,
            name: item.nom,
            category: item.categorie || '',
            image: item.image || '',
            quantity: Number(item.quantite) || 0,
            unitPrice: Number(item.prix_unitaire) || 0,
            weight: Number(item.poids) || 0
        }));

        renderObjets();

    } catch (error) {
        console.error('Erreur de chargement des objets :', error);

        objetCards.innerHTML =
            '<p class="muted">Impossible de charger les objets.</p>';

        notify('Impossible de charger les objets partagés.', 'error');
    }
}

    function renderObjets() {
        let totalQuantity = 0;
        let totalValue = 0;

        objets.forEach(item => {
            totalQuantity += item.quantity;
            totalValue += item.quantity * item.unitPrice;
        });

        objetProductCount.textContent = objets.length;
        objetQuantityTotal.textContent =
            totalQuantity.toLocaleString('fr-FR');
        objetValueTotal.textContent = objetMoney(totalValue);

        if (objets.length === 0) {
            objetCards.innerHTML =
                '<p class="muted">Aucun objet enregistré.</p>';
            return;
        }
        
        objetCards.innerHTML = objets.map(item => {
            const imageHtml = item.image
                ? `<img class="stock-product-image"
                        src="${escapeHtml(item.image)}"
                        alt="${escapeHtml(item.name)}"
                        onerror="this.style.display='none'">`
                : '<div class="stock-product-placeholder">📦</div>';

            return `
                <article class="stock-product-card">
                    <div class="stock-product-visual">
                        ${imageHtml}
                    </div>

                    <div class="stock-product-info">
                        <div class="stock-product-heading">
                            <h4>${escapeHtml(item.name)}</h4>
                            <strong>${objetMoney(item.quantity * item.unitPrice)}</strong>
                        </div>

                        <span class="stock-product-category">
                            ${escapeHtml(item.category)}
                        </span>

                        <div class="stock-product-details">
                            <span>Quantité : ${item.quantity}</span>
                            <span>Unitaire : ${objetMoney(item.unitPrice)}</span>
                            <span>Poids : ${item.weight} kg</span>
                        </div>

                        <div class="stock-product-actions">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value="${item.quantity}"
                                aria-label="Nouvelle quantité pour ${escapeHtml(item.name)}"
                                data-objet-quantity="${escapeHtml(item.id)}"
                            >

                            <button
                                type="button"
                                class="primary-btn"
                                data-objet-update="${escapeHtml(item.id)}"
                            >
                                Mettre à jour
                            </button>
                        </div>

                        <button
                            type="button"
                            class="secondary-btn objet-edit-btn"
                            data-objet-edit="${escapeHtml(item.id)}"
                        >
                            Modifier les informations
                        </button>

                        <button
                            type="button"
                            class="secondary-btn stock-delete-btn"
                            data-objet-delete="${escapeHtml(item.id)}"
                        >
                            Supprimer
                        </button>

                    </div>
                </article>
            `;
        }).join('');
    }

    async function saveObjet(item) {
        const row = {
            id: String(item.id),
            nom: item.name,
            categorie: item.category,
            image: item.image || '',
            quantite: Number(item.quantity) || 0,
            prix_unitaire: Number(item.unitPrice) || 0,
            poids: Number(item.weight) || 0
        };

        const { error } = await supabaseClient
            .from('objets')
            .upsert(row, { onConflict: 'id' });

        if (error) throw error;
    }

    objetForm.addEventListener('submit', async event => {
        event.preventDefault();

        const name = objetName.value.trim();
        const category = objetCategory.value.trim();
        const image = objetImage.value.trim();
        const quantity = Number(objetQuantity.value);
        const unitPrice = Number(objetUnitPrice.value);

        if (
            !name ||
            !category ||
            objetQuantity.value.trim() === '' ||
            objetUnitPrice.value.trim() === '' ||
            !Number.isInteger(quantity) ||
            quantity < 0 ||
            !Number.isFinite(unitPrice) ||
            unitPrice < 0
        ) {
            notify('Vérifie les informations de l’objet.', 'error');
            return;
        }

        const button = objetForm.querySelector('button[type="submit"]');
        button.disabled = true;

        const item = {
            id: String(Date.now()) + '-' +
                Math.random().toString(16).slice(2),
            name,
            category,
            image,
            quantity,
            unitPrice
        };

        try {
            await saveObjet(item);
            objets.push(item);
            renderObjets();
            objetForm.reset();
            notify('Objet ajouté avec succès.', 'success');
        } catch (error) {
            console.error('Erreur de sauvegarde de l’objet :', error);
            notify('Impossible de sauvegarder cet objet.', 'error');
        } finally {
            button.disabled = false;
        }
    });

    objetCards.addEventListener('click', async event => {
       
    const editButton = event.target.closest('[data-objet-edit]');
    const updateButton = event.target.closest('[data-objet-update]');
    const deleteButton = event.target.closest('[data-objet-delete]');


        
        if (editButton) {
            const id = editButton.getAttribute('data-objet-edit');
            const item = objets.find(obj => String(obj.id) === String(id));
        
            if (item) {
                ouvrirModificationObjet(item);
            }
        
            return;
        }

        
        if (updateButton) {
            const id = updateButton.getAttribute('data-objet-update');
            const input = objetCards.querySelector(
                '[data-objet-quantity="' + id + '"]'
            );

            const quantity = Number(input.value);

            if (
                input.value.trim() === '' ||
                !Number.isInteger(quantity) ||
                quantity < 0
            ) {
                notify('Entre une quantité entière positive ou zéro.', 'error');
                return;
            }

            const item = objets.find(obj => obj.id === id);
            if (!item) return;

            const previousQuantity = item.quantity;
            item.quantity = quantity;
            updateButton.disabled = true;

            try {
                await saveObjet(item);
                renderObjets();
                notify('Quantité mise à jour.', 'success');
            } catch (error) {
                item.quantity = previousQuantity;
                console.error('Erreur de mise à jour :', error);
                renderObjets();
                notify('Impossible de mettre à jour la quantité.', 'error');
            }

            return;
        }

        if (deleteButton) {
            const id = deleteButton.getAttribute('data-objet-delete');
            const item = objets.find(obj => obj.id === id);

            if (!item) return;

            if (!window.confirm(
                'Veux-tu vraiment supprimer l’objet "' + item.name + '" ?'
            )) {
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('objets')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                objets = objets.filter(obj => obj.id !== id);
                renderObjets();
                notify('Objet supprimé.', 'success');
            } catch (error) {
                console.error('Erreur de suppression :', error);
                notify('Impossible de supprimer cet objet.', 'error');
            }
        }
    });

     loadObjets();
})();
    
/* Fenêtre de modification des objets */
const objetEditModal = document.getElementById('objetEditModal');
const objetEditForm = document.getElementById('objetEditForm');
const objetEditClose = document.getElementById('objetEditClose');
const objetEditCancel = document.getElementById('objetEditCancel');

let objetEnModification = null;

function ouvrirModificationObjet(item) {
    if (!objetEditModal || !objetEditForm) {
        alert("La fenêtre de modification est introuvable dans index.html.");
        return;
    }

    objetEnModification = item;

    const nom = document.getElementById('objetEditName');
    const categorie = document.getElementById('objetEditCategory');
    const image = document.getElementById('objetEditImage');
    const quantite = document.getElementById('objetEditQuantity');
    const prix = document.getElementById('objetEditPrice');
    const poids = document.getElementById('objetEditWeight');

    if (nom) nom.value = item.name || '';
    if (categorie) categorie.value = item.category || '';
    if (image) image.value = item.image || '';
    if (quantite) quantite.value = item.quantity ?? 0;
    if (prix) prix.value = item.unitPrice ?? 0;
    if (poids) poids.value = item.weight ?? '';

    objetEditModal.classList.add('objet-modal-open');
    objetEditModal.setAttribute('aria-hidden', 'false');
}

function fermerModificationObjet() {
    if (!objetEditModal) return;

    objetEditModal.classList.remove('objet-modal-open');
    objetEditModal.setAttribute('aria-hidden', 'true');
    objetEnModification = null;
}

objetCards.addEventListener('click', function(event) {
    const bouton = event.target.closest('[data-objet-edit]');
    if (!bouton) return;

    const id = bouton.getAttribute('data-objet-edit');
    const item = objets.find(obj => String(obj.id) === String(id));

    if (item) ouvrirModificationObjet(item);
});

if (objetEditClose) {
    objetEditClose.addEventListener('click', fermerModificationObjet);
}

if (objetEditCancel) {
    objetEditCancel.addEventListener('click', fermerModificationObjet);
}

if (objetEditModal) {
    objetEditModal.addEventListener('click', function(event) {
        if (event.target === objetEditModal) {
            fermerModificationObjet();
        }
    });
}

if (objetEditForm) {
    objetEditForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!objetEnModification) return;

        const boutonEnregistrer = objetEditForm.querySelector(
            'button[type="submit"]'
        );

        if (boutonEnregistrer) boutonEnregistrer.disabled = true;

       const itemModifie = {
    ...objetEnModification,
    name: document.getElementById('objetEditName').value.trim(),
    category: document.getElementById('objetEditCategory').value,
    image: document.getElementById('objetEditImage').value.trim(),
    quantity: Number(document.getElementById('objetEditQuantity').value),
    unitPrice: Number(document.getElementById('objetEditPrice').value),
    weight: Number(document.getElementById('objetEditWeight').value) || 0
};
        
        try {
            if (!itemModifie.name || itemModifie.quantity < 0 ||
                itemModifie.unitPrice < 0 ||
                !Number.isFinite(itemModifie.quantity) ||
                !Number.isFinite(itemModifie.unitPrice)) {
                alert("Vérifie le nom, la quantité et le prix.");
                return;
            }

            await saveObjet(itemModifie);

            const index = objets.findIndex(
                obj => String(obj.id) === String(itemModifie.id)
            );

            if (index !== -1) {
                objets[index] = itemModifie;
            }

            renderObjets();
            fermerModificationObjet();
        } catch (error) {
            console.error("Erreur de modification de l'objet :", error);
            alert("Impossible d'enregistrer les modifications dans Supabase.");
        } finally {
            if (boutonEnregistrer) boutonEnregistrer.disabled = false;
        }
    });
}
})();


/* Navigation des sous-onglets Objets */
(() => {
    const objetTabs = document.querySelectorAll('[data-objet-tab]');
    const objetContents = document.querySelectorAll('.objet-tab-content');

    objetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-objet-tab');

            objetTabs.forEach(button => {
                button.classList.toggle('active', button === tab);
            });

            objetContents.forEach(content => {
                content.classList.toggle(
                    'active',
                    content.id === 'objet-content-' + target
                );
            });
        });
    });
})();



/* Ouverture et fermeture du formulaire Objet */
(() => {
    const toggle = document.getElementById('objetFormToggle');
    const panel = document.querySelector('.objet-form-panel');

    if (!toggle || !panel) return;

    const arrow = toggle.querySelector('.objet-form-arrow');

    function updateObjetArrow() {
        const isOpen = panel.classList.contains('objet-form-open');

        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        if (arrow) {
            arrow.textContent = isOpen ? '▼' : '▶';
        }
    }

    function toggleObjetForm() {
        panel.classList.toggle('objet-form-open');
        updateObjetArrow();
    }

    toggle.addEventListener('click', toggleObjetForm);

    toggle.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleObjetForm();
        }
    });

    updateObjetArrow();
})();


/* Menu dépliant : Objets Illégaux */
(function () {
    const toggle = document.getElementById('objetListToggle');
    const content = document.getElementById('objetListWrapper');
    console.log("Conteneur objets :", content);
    console.log("Cartes objets :", document.getElementById('objetCards'));
    
    if (!toggle || !content) return;

    function basculerObjets() {
        const replie = content.classList.toggle('replie');

        toggle.setAttribute('aria-expanded', String(!replie));

        const fleche = toggle.querySelector('.objet-form-arrow');
        if (fleche) {
            fleche.textContent = replie ? '▶' : '▼';
        }
    }

    content.classList.add('replie');

    toggle.addEventListener('click', basculerObjets);

    toggle.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            basculerObjets();
        }
    });
})();
