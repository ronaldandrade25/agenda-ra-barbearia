// ===== MENU MOBILE =====
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuToggle?.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = menuToggle.querySelector('i');
    if (navLinks.classList.contains('active')) { icon.classList.remove('bx-menu'); icon.classList.add('bx-x'); }
    else { icon.classList.remove('bx-x'); icon.classList.add('bx-menu'); }
});

// ===== FIREBASE (CDN modular) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    initializeFirestore,
    collection, query, where, getDocs,
    doc, getDoc, setDoc, updateDoc, deleteDoc,
    runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Config do seu projeto
const firebaseConfig = {
    apiKey: "AIzaSyD8q8N8l6lG-4YGNDZ6Lfs63yW6IS2lqFc",
    authDomain: "ra-barbearia-a8e60.firebaseapp.com",
    projectId: "ra-barbearia-a8e60",
    storageBucket: "ra-barbearia-a8e60.firebasestorage.app",
    messagingSenderId: "6836920871",
    appId: "1:6836920871:web:2b52193c00af7136436402",
    measurementId: "G-RBBGBQ82W4"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
const auth = getAuth(app);



// ===== ADMIN AUTORIZADO (reforço de UX; segurança real está nas REGRAS) =====
const ADMINS = ["rabarbearia966@gmail.com"]; // TODO: troque para o seu e-mail

// ===== MAPEAMENTO DOS PROFISSIONAIS (mesmos data-col do site público) =====
const PROFISSIONAIS = [
    { label: 'Rodrigo', colecao: 'reservas_rodrigo', wa: '5581996221060' },
    { label: 'Lucas Wilhy', colecao: 'reservas_lucas', wa: '5581996221060' },
    { label: 'Melquer', colecao: 'reservas_melquer', wa: '5581996221060' },
];

// ===== DOM =====
const $ = (s) => document.querySelector(s);
const tbody = $('#tbody');
const metaInfo = $('#metaInfo');
const profissionalSelect = $('#profissionalSelect');
const dataFiltro = $('#dataFiltro');
const horaFiltro = $('#horaFiltro');
const buscarBtn = $('#buscarBtn');

// Login
const authGate = $('#authGate');
const authEmail = $('#authEmail');
const authPassword = $('#authPassword');
const authSubmit = $('#authSubmit');
const authError = $('#authError');
const logoutBtn = $('#logoutBtn');

// Modal editar
const editModal = $('#editModal');
const closeEdit = $('#closeEdit');
const salvarBtnModal = $('#salvarBtnModal');
const cancelarBtnModal = $('#cancelarBtnModal');
const editCliente = $('#editCliente');
const editData = $('#editData');
const editHora = $('#editHora');

// ===== ESTADO/HELPERS =====
let currentRow = null; // { colecao, slotId, data, hora, profissional, clienteNome }
const toKey = (ymd, hhmm) => `${ymd}_${hhmm}`;
const normalizeHora = (h) => h?.padStart(5, '0');
const fmtBR = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString('pt-BR');

function fillProfissionais() {
    profissionalSelect.innerHTML = PROFISSIONAIS
        .map(p => `<option value="${p.colecao}">${p.label}</option>`)
        .join('');
}
function setHoje() {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const d = String(hoje.getDate()).padStart(2, '0');
    dataFiltro.value = `${y}-${m}-${d}`;
}

// ===== BUSCA / LISTAGEM =====
async function buscar() {
    tbody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;
    const colecao = profissionalSelect.value;
    const ymd = dataFiltro.value;
    const hhmmFiltro = horaFiltro.value;

    if (!colecao || !ymd) {
        tbody.innerHTML = `<tr><td colspan="6">Selecione profissional e data.</td></tr>`;
        return;
    }
    try {
        const q = hhmmFiltro
            ? query(collection(db, colecao), where('data', '==', ymd), where('hora', '==', hhmmFiltro))
            : query(collection(db, colecao), where('data', '==', ymd));

        const snap = await getDocs(q);
        const rows = [];
        snap.forEach(d => {
            const v = d.data();
            rows.push({
                slotId: d.id,
                colecao,
                clienteNome: v?.clienteNome || '',
                profissional: v?.profissional || '-',
                data: v?.data,
                hora: v?.hora,
                createdAt: v?.createdAt || null
            });
        });
        renderRows(rows, { colecao, ymd, count: rows.length });
    } catch (e) {
        console.error('Erro ao buscar:', e);
        tbody.innerHTML = `<tr><td colspan="6">Erro ao buscar (${e?.message || e}). Verifique as regras do Firestore.</td></tr>`;
    }
}

function renderRows(rows, meta) {
    metaInfo.innerHTML = `
    <span class="badge"><i class='bx bx-user-circle'></i> Coleção: <strong>${meta.colecao}</strong></span>
    <span class="badge"><i class='bx bx-calendar'></i> Data: <strong>${fmtBR(meta.ymd)}</strong></span>
    <span class="badge"><i class='bx bx-list-ul'></i> Itens: <strong>${meta.count}</strong></span>
  `;
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6">Nenhum agendamento para este filtro.</td></tr>`;
        return;
    }
    tbody.innerHTML = rows
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .map(r => `
      <tr>
        <td>${r.clienteNome || '—'}</td>
        <td>${r.profissional}</td>
        <td>${fmtBR(r.data)}</td>
        <td>${r.hora}</td>
        <td style="font-family: ui-monospace, Menlo, Consolas, monospace; color:#666;">${r.slotId}</td>
        <td>
          <div class="actions">
            <button class="btn btn-edit" data-action="edit" data-id="${r.slotId}" data-col="${r.colecao}">Editar</button>
            <button class="btn btn-del"  data-action="del"  data-id="${r.slotId}" data-col="${r.colecao}">Desmarcar</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Liga ações (as regras do Firestore barram se não for admin)
    tbody.querySelectorAll('button[data-action="edit"]').forEach(b =>
        b.addEventListener('click', () => openEdit(b.dataset.col, b.dataset.id)));
    tbody.querySelectorAll('button[data-action="del"]').forEach(b =>
        b.addEventListener('click', () => removeSlot(b.dataset.col, b.dataset.id)));
}

// ===== EDITAR / DESMARCAR =====
async function openEdit(colecao, slotId) {
    try {
        const ref = doc(db, colecao, slotId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return alert('Documento não encontrado.');
        const v = snap.data();
        currentRow = {
            colecao, slotId,
            data: v.data, hora: v.hora,
            profissional: v.profissional,
            clienteNome: v.clienteNome || ''
        };
        editCliente.value = currentRow.clienteNome || '';
        editData.value = currentRow.data;
        editHora.value = currentRow.hora;
        editModal.classList.add('open');
    } catch (e) {
        console.error('openEdit error:', e);
        alert('Erro ao abrir edição. Verifique se você está logado.');
    }
}
function closeModal() { editModal.classList.remove('open'); currentRow = null; }
closeEdit?.addEventListener('click', closeModal);

async function removeSlot(colecao, slotId) {
    const ok = confirm('Tem certeza que deseja desmarcar este horário?');
    if (!ok) return;
    try {
        await deleteDoc(doc(db, colecao, slotId));
        await buscar();
    } catch (e) {
        console.error('delete error:', e);
        alert('Não foi possível desmarcar. Verifique se você está logado e as regras do Firestore.');
    }
}
cancelarBtnModal?.addEventListener('click', async () => {
    if (!currentRow) return;
    await removeSlot(currentRow.colecao, currentRow.slotId);
    closeModal();
});

salvarBtnModal?.addEventListener('click', async () => {
    if (!currentRow) return;
    const novoNome = (editCliente.value || '').trim();
    const novaData = editData.value;
    const novaHora = normalizeHora(editHora.value);

    // Só alterar nome
    if (novaData === currentRow.data && novaHora === currentRow.hora) {
        try {
            await updateDoc(doc(db, currentRow.colecao, currentRow.slotId), { clienteNome: novoNome || null });
            closeModal(); await buscar();
        } catch (e) {
            console.error('updateDoc error:', e);
            alert('Não foi possível salvar. Verifique se você está logado.');
        }
        return;
    }

    // Mover horário (transação evita conflito)
    try {
        const oldRef = doc(db, currentRow.colecao, currentRow.slotId);
        const newId = toKey(novaData, novaHora);
        const newRef = doc(db, currentRow.colecao, newId);
        await runTransaction(db, async (tx) => {
            const oldSnap = await tx.get(oldRef);
            if (!oldSnap.exists()) throw new Error('Original não existe mais.');
            const newSnap = await tx.get(newRef);
            if (newSnap.exists()) throw new Error('Horário já reservado.');
            const payload = {
                data: novaData, hora: novaHora, profissional: currentRow.profissional,
                clienteNome: novoNome || null, createdAt: serverTimestamp()
            };
            tx.set(newRef, payload);
            tx.delete(oldRef);
        });
        closeModal(); await buscar();
    } catch (e) {
        console.error('transaction error:', e);
        alert(e?.message || 'Falha ao mover o agendamento. Verifique se você está logado.');
    }
});

// ===== AUTH (login/logout) =====
function toggleGate(show) {
    if (show) authGate?.classList.remove('hidden');
    else authGate?.classList.add('hidden');
}
authSubmit?.addEventListener('click', async () => {
    authError.textContent = '';
    const email = (authEmail.value || '').trim();
    const pass = authPassword.value || '';
    if (!email || !pass) { authError.textContent = 'Informe e-mail e senha.'; return; }
    authSubmit.disabled = true; authSubmit.textContent = 'Entrando...';
    try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        if (ADMINS.length && !ADMINS.includes(cred.user.email)) {
            // não está na lista de admins desta UI (regras do Firestore continuarão protegendo)
            await signOut(auth);
            throw new Error('Este usuário não tem acesso ao painel.');
        }
    } catch (e) {
        authError.textContent = (e?.code === 'auth/invalid-credential')
            ? 'Credenciais inválidas.'
            : (e?.message || 'Falha ao entrar.');
    } finally {
        authSubmit.disabled = false; authSubmit.textContent = 'Entrar';
    }
});

logoutBtn?.addEventListener('click', () => signOut(auth).catch(console.error));

onAuthStateChanged(auth, (user) => {
    const ok = !!user && (ADMINS.length ? ADMINS.includes(user.email) : true);
    toggleGate(!ok);
    if (ok) {
        logoutBtn?.classList.remove('hidden');
        // recarrega lista (caso tenha aberto antes de logar)
        buscar();
    } else {
        logoutBtn?.classList.add('hidden');
    }
});

// ===== INICIALIZAÇÃO =====
(function init() {
    fillProfissionais();
    setHoje();
    buscarBtn.addEventListener('click', buscar);
    buscar(); // primeira carga (leitura é pública)
})();

