const tablet = document.getElementById('tablet');
const balanceEl = document.getElementById('balance');
const historyEl = document.getElementById('history');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const descriptionEl = document.getElementById('description');
const toastEl = document.getElementById('toast');
let externalUrl = 'file:///C:/Users/Utilisateur/source/repos/ConsoleApp1/ConsoleApp1.slnx';
let toastTimer = null;

function money(value) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR'
    }).format(Number(value) || 0);
}

function notify(message, kind = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3500);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function renderData(data) {
    const balance = Number(data?.balance) || 0;
    balanceEl.textContent = money(balance);
    const transactions = Array.isArray(data?.transactions) ? data.transactions : [];

    if (!transactions.length) {
        historyEl.innerHTML = '<tr><td colspan="5" class="empty">Aucune operation enregistree.</td></tr>';
        return;
    }

    historyEl.innerHTML = transactions.map(tx => {
        const incoming = tx.type === 'entree';
        const label = incoming ? 'Entree' : 'Sortie';
        const amount = Number(tx.amount) || 0;
        return `<tr>
            <td>${escapeHtml(tx.date || '')}</td>
            <td><span class="type-pill ${incoming ? 'in' : 'out'}">${label}</span></td>
            <td>${escapeHtml(tx.description || '')}</td>
            <td>${escapeHtml(tx.player || '')}</td>
            <td class="right ${incoming ? 'amount-in' : 'amount-out'}">${incoming ? '+' : '−'} ${money(amount)}</td>
        </tr>`;
    }).join('');
}

function postNui(name, data = {}) {
    return fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data)
    }).then(response => response.json()).catch(() => ({}));
}

function closeTablet() {
    tablet.classList.add('hidden');
    postNui('close');
}

document.getElementById('closeBtn').addEventListener('click', closeTablet);
document.getElementById('refreshBtn').addEventListener('click', () => postNui('requestData'));

document.getElementById('submitBtn').addEventListener('click', async () => {
    const amount = Number(amountEl.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        notify('Entre un montant superieur a zero.', 'error');
        return;
    }

    const button = document.getElementById('submitBtn');
    button.disabled = true;
    await postNui('transaction', {
        type: typeEl.value,
        amount,
        description: descriptionEl.value.trim()
    });
    amountEl.value = '';
    descriptionEl.value = '';
    button.disabled = false;
});

document.getElementById('externalBtn').addEventListener('click', async () => {
    const result = await postNui('openExternal');
    const url = result?.url || externalUrl;
    if (!/^https?:\/\//i.test(url)) {
        notify('Le lien externe configure est invalide.', 'error');
        return;
    }

    // openUrl est une fonction NUI fournie par FiveM.
    if (typeof window.invokeNative === 'function') {
        window.invokeNative('openUrl', url);
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
});

window.addEventListener('message', event => {
    const msg = event.data || {};
    if (msg.externalUrl) externalUrl = msg.externalUrl;

    if (msg.action === 'open') {
        tablet.classList.remove('hidden');
    } else if (msg.action === 'close') {
        tablet.classList.add('hidden');
    } else if (msg.action === 'data') {
        renderData(msg.data || {});
    } else if (msg.action === 'notify') {
        notify(msg.message || '', msg.kind || 'info');
    } else if (msg.action === 'externalUrl') {
        if (msg.externalUrl) externalUrl = msg.externalUrl;
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !tablet.classList.contains('hidden')) closeTablet();
});
