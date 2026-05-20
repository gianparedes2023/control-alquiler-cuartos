const state = {
  rooms: [],
  payments: [],
  users: [],
};

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

const supabaseConfig = window.APP_SUPABASE || {};
const supabaseReady = Boolean(
  window.supabase &&
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  !supabaseConfig.url.includes("PEGA_AQUI") &&
  !supabaseConfig.anonKey.includes("PEGA_AQUI")
);
const db = supabaseReady ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;

let currentUser = null;
let currentPage = "control";

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  currentUserName: document.querySelector("#currentUserName"),
  currentUserRole: document.querySelector("#currentUserRole"),
  navButtons: document.querySelectorAll("[data-page-target]"),
  pages: document.querySelectorAll("[data-page]"),
  usersNavBtn: document.querySelector("#usersNavBtn"),
  monthPicker: document.querySelector("#monthPicker"),
  expectedTotal: document.querySelector("#expectedTotal"),
  paidTotal: document.querySelector("#paidTotal"),
  pendingTotal: document.querySelector("#pendingTotal"),
  occupancy: document.querySelector("#occupancy"),
  roomRows: document.querySelector("#roomRows"),
  paymentRows: document.querySelector("#paymentRows"),
  paymentRoom: document.querySelector("#paymentRoom"),
  paymentCount: document.querySelector("#paymentCount"),
  roomForm: document.querySelector("#roomForm"),
  paymentForm: document.querySelector("#paymentForm"),
  clearRoom: document.querySelector("#clearRoom"),
  exportCsv: document.querySelector("#exportCsv"),
  userAdminPanel: document.querySelector("#userAdminPanel"),
  userForm: document.querySelector("#userForm"),
  userRows: document.querySelector("#userRows"),
  clearUser: document.querySelector("#clearUser"),
  collectionRate: document.querySelector("#collectionRate"),
  delinquencyRate: document.querySelector("#delinquencyRate"),
  roomsWithDebt: document.querySelector("#roomsWithDebt"),
  averageRent: document.querySelector("#averageRent"),
  incidentCount: document.querySelector("#incidentCount"),
  incidentList: document.querySelector("#incidentList"),
  reportMonthLabel: document.querySelector("#reportMonthLabel"),
  collectionProgressLabel: document.querySelector("#collectionProgressLabel"),
  collectionProgressBar: document.querySelector("#collectionProgressBar"),
  reportExpected: document.querySelector("#reportExpected"),
  reportPaid: document.querySelector("#reportPaid"),
  reportPending: document.querySelector("#reportPending"),
  availableRooms: document.querySelector("#availableRooms"),
  incidentRows: document.querySelector("#incidentRows"),
  recentPaymentTotal: document.querySelector("#recentPaymentTotal"),
  recentPaymentRows: document.querySelector("#recentPaymentRows"),
};

const fields = {
  roomId: document.querySelector("#roomId"),
  roomName: document.querySelector("#roomName"),
  tenantName: document.querySelector("#tenantName"),
  tenantPhone: document.querySelector("#tenantPhone"),
  monthlyRent: document.querySelector("#monthlyRent"),
  dueDay: document.querySelector("#dueDay"),
  roomStatus: document.querySelector("#roomStatus"),
  paymentDate: document.querySelector("#paymentDate"),
  paymentAmount: document.querySelector("#paymentAmount"),
  paymentNote: document.querySelector("#paymentNote"),
  userId: document.querySelector("#userId"),
  userName: document.querySelector("#userName"),
  username: document.querySelector("#username"),
  userRole: document.querySelector("#userRole"),
  userActive: document.querySelector("#userActive"),
};

init();

async function init() {
  els.monthPicker.value = monthKey(new Date());
  fields.paymentDate.value = todayKey();
  bindEvents();

  if (!supabaseReady) {
    showLogin();
    els.loginError.textContent = "Configura Supabase en supabase-config.js antes de iniciar sesion.";
    els.loginForm.querySelector("button").disabled = true;
    return;
  }

  const { data } = await db.auth.getSession();
  if (data.session) await loadSessionUser();
  else showLogin();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", logout);
  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.pageTarget));
  });
  els.monthPicker.addEventListener("change", render);
  els.roomForm.addEventListener("submit", saveRoom);
  els.paymentForm.addEventListener("submit", savePayment);
  els.userForm.addEventListener("submit", saveUser);
  els.clearRoom.addEventListener("click", clearRoomForm);
  els.clearUser.addEventListener("click", clearUserForm);
  els.exportCsv.addEventListener("click", exportCsv);
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = "";

  const email = els.loginUsername.value.trim().toLowerCase();
  const password = els.loginPassword.value;
  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    els.loginError.textContent = authErrorMessage(error);
    console.warn("Supabase login error:", error.message);
    return;
  }

  await loadSessionUser();
  els.loginForm.reset();
}

async function loadSessionUser() {
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError || !authData.user) {
    showLogin();
    return;
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || !profile.active) {
    await db.auth.signOut();
    showLogin();
    els.loginError.textContent = "Tu usuario no esta activo o no tiene perfil configurado.";
    return;
  }

  currentUser = profileToUser(profile);
  await db.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", currentUser.id);
  await loadData();
  showApp();
}

async function loadData() {
  const [roomsResult, paymentsResult, profilesResult] = await Promise.all([
    db.from("rooms").select("*").order("name", { ascending: true }),
    db.from("payments").select("*").order("date", { ascending: false }),
    db.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  if (roomsResult.error) throwAlert(roomsResult.error.message);
  if (paymentsResult.error) throwAlert(paymentsResult.error.message);
  if (profilesResult.error && canAdmin()) throwAlert(profilesResult.error.message);

  state.rooms = (roomsResult.data || []).map(rowToRoom);
  state.payments = (paymentsResult.data || []).map(rowToPayment);
  state.users = (profilesResult.data || []).map(profileToUser);
}

function throwAlert(message) {
  alert(`Error de Supabase: ${message}`);
}

function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("email not confirmed")) {
    return "El correo existe, pero falta confirmarlo en Supabase Auth.";
  }
  if (message.includes("invalid login credentials")) {
    return "Supabase no reconoce ese correo/contrasena. Revisa que el usuario exista en Authentication > Users y este confirmado.";
  }
  return `Error de acceso: ${error?.message || "No se pudo iniciar sesion."}`;
}

async function logout() {
  await db.auth.signOut();
  currentUser = null;
  currentPage = "control";
  state.rooms = [];
  state.payments = [];
  state.users = [];
  showLogin();
}

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  els.loginUsername.focus();
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.currentUserName.textContent = currentUser.name;
  els.currentUserRole.textContent = roleLabel(currentUser.role);
  applyPermissions();
  showPage(currentPage);
  render();
}

function applyPermissions() {
  const writable = canWrite();
  const admin = canAdmin();

  setFormDisabled(els.roomForm, !writable);
  setFormDisabled(els.paymentForm, !writable);
  els.clearRoom.disabled = !writable;
  els.usersNavBtn.classList.toggle("hidden", !admin);
  if (!admin && currentPage === "users") currentPage = "control";
}

function showPage(page) {
  if (page === "users" && !canAdmin()) page = "control";
  currentPage = page;
  els.pages.forEach((section) => section.classList.toggle("hidden", section.dataset.page !== page));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.pageTarget === page));
}

function setFormDisabled(form, disabled) {
  form.querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = disabled;
  });
}

async function saveRoom(event) {
  event.preventDefault();
  if (!canWrite()) return;

  const room = {
    name: fields.roomName.value.trim(),
    tenant: fields.tenantName.value.trim(),
    phone: fields.tenantPhone.value.trim(),
    rent: Number(fields.monthlyRent.value || 0),
    due_day: Number(fields.dueDay.value || 1),
    status: fields.roomStatus.value,
    updated_at: new Date().toISOString(),
  };

  const query = fields.roomId.value
    ? db.from("rooms").update(room).eq("id", fields.roomId.value).select().single()
    : db.from("rooms").insert(room).select().single();
  const { data, error } = await query;

  if (error) {
    throwAlert(error.message);
    return;
  }

  const saved = rowToRoom(data);
  const index = state.rooms.findIndex((item) => item.id === saved.id);
  if (index >= 0) state.rooms[index] = saved;
  else state.rooms.push(saved);
  state.rooms.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

  clearRoomForm();
  render();
}

async function savePayment(event) {
  event.preventDefault();
  if (!canWrite()) return;

  const payment = {
    room_id: els.paymentRoom.value,
    date: fields.paymentDate.value,
    amount: Number(fields.paymentAmount.value || 0),
    note: fields.paymentNote.value.trim(),
  };
  const { data, error } = await db.from("payments").insert(payment).select().single();

  if (error) {
    throwAlert(error.message);
    return;
  }

  state.payments.push(rowToPayment(data));
  fields.paymentAmount.value = "";
  fields.paymentNote.value = "";
  render();
}

async function saveUser(event) {
  event.preventDefault();
  if (!canAdmin()) return;

  if (!fields.userId.value) {
    alert("Primero crea el usuario en Supabase Auth. Luego podras editar su rol aqui.");
    return;
  }

  const profile = {
    name: fields.userName.value.trim(),
    email: fields.username.value.trim().toLowerCase(),
    role: fields.userRole.value,
    active: fields.userActive.checked,
  };

  if (fields.userId.value === currentUser.id && !profile.active) {
    alert("No puedes desactivar tu propio usuario mientras estas dentro.");
    return;
  }

  const { data, error } = await db
    .from("profiles")
    .update(profile)
    .eq("id", fields.userId.value)
    .select()
    .single();

  if (error) {
    throwAlert(error.message);
    return;
  }

  const saved = profileToUser(data);
  const index = state.users.findIndex((user) => user.id === saved.id);
  if (index >= 0) state.users[index] = saved;

  if (saved.id === currentUser.id) {
    currentUser = saved;
    els.currentUserName.textContent = currentUser.name;
    els.currentUserRole.textContent = roleLabel(currentUser.role);
    applyPermissions();
  }

  clearUserForm();
  renderUsers();
}

function editRoom(id) {
  if (!canWrite()) return;
  const room = state.rooms.find((item) => item.id === id);
  if (!room) return;
  fields.roomId.value = room.id;
  fields.roomName.value = room.name;
  fields.tenantName.value = room.tenant;
  fields.tenantPhone.value = room.phone;
  fields.monthlyRent.value = room.rent;
  fields.dueDay.value = room.dueDay;
  fields.roomStatus.value = room.status;
  fields.roomName.focus();
}

async function deleteRoom(id) {
  if (!canWrite()) return;
  const room = state.rooms.find((item) => item.id === id);
  if (!room || !confirm(`Eliminar ${room.name}? Tambien se borraran sus pagos.`)) return;

  const { error } = await db.from("rooms").delete().eq("id", id);
  if (error) {
    throwAlert(error.message);
    return;
  }

  state.rooms = state.rooms.filter((item) => item.id !== id);
  state.payments = state.payments.filter((item) => item.roomId !== id);
  render();
}

async function deletePayment(id) {
  if (!canWrite()) return;

  const { error } = await db.from("payments").delete().eq("id", id);
  if (error) {
    throwAlert(error.message);
    return;
  }

  state.payments = state.payments.filter((item) => item.id !== id);
  render();
}

async function quickPayRoom(id) {
  if (!canWrite()) return;

  const selectedMonth = els.monthPicker.value;
  const room = state.rooms.find((item) => item.id === id);
  if (!room || room.status !== "occupied") return;

  const paid = state.payments
    .filter((payment) => payment.roomId === id && monthKey(new Date(`${payment.date}T00:00:00`)) === selectedMonth)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const due = Math.max(room.rent - paid, 0);
  if (due <= 0) return;

  if (!confirm(`Registrar pago rapido de ${money.format(due)} para ${room.name}?`)) return;

  const payment = {
    room_id: id,
    date: paymentDateForMonth(selectedMonth),
    amount: due,
    note: "Pago rapido",
  };
  const { data, error } = await db.from("payments").insert(payment).select().single();
  if (error) {
    throwAlert(error.message);
    return;
  }

  state.payments.push(rowToPayment(data));
  render();
}

function editUser(id) {
  if (!canAdmin()) return;
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  fields.userId.value = user.id;
  fields.userName.value = user.name;
  fields.username.value = user.username;
  fields.userRole.value = user.role;
  fields.userActive.checked = user.active;
  fields.userName.focus();
}

async function deleteUser(id) {
  if (!canAdmin()) return;
  if (id === currentUser.id) {
    alert("No puedes eliminar tu propio usuario.");
    return;
  }

  const user = state.users.find((item) => item.id === id);
  if (!user || !confirm(`Desactivar el usuario ${user.username}?`)) return;

  const { data, error } = await db
    .from("profiles")
    .update({ active: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throwAlert(error.message);
    return;
  }

  const saved = profileToUser(data);
  const index = state.users.findIndex((item) => item.id === id);
  if (index >= 0) state.users[index] = saved;
  renderUsers();
}

function clearRoomForm() {
  els.roomForm.reset();
  fields.roomId.value = "";
  fields.dueDay.value = 5;
  fields.roomStatus.value = "occupied";
}

function clearUserForm() {
  els.userForm.reset();
  fields.userId.value = "";
  fields.userRole.value = "operator";
  fields.userActive.checked = true;
}

function render() {
  const selectedMonth = els.monthPicker.value;
  const monthPayments = state.payments.filter((payment) => monthKey(new Date(`${payment.date}T00:00:00`)) === selectedMonth);
  const occupiedRooms = state.rooms.filter((room) => room.status === "occupied");
  const expected = occupiedRooms.reduce((sum, room) => sum + room.rent, 0);
  const paid = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);

  els.expectedTotal.textContent = money.format(expected);
  els.paidTotal.textContent = money.format(paid);
  els.pendingTotal.textContent = money.format(Math.max(expected - paid, 0));
  els.occupancy.textContent = `${occupiedRooms.length}/${state.rooms.length}`;

  renderRoomOptions();
  renderRooms(monthPayments, selectedMonth);
  renderPayments(monthPayments);
  renderReports(monthPayments, selectedMonth);
  renderUsers();
}

function renderRoomOptions() {
  const occupied = state.rooms.filter((room) => room.status === "occupied");
  els.paymentRoom.innerHTML = occupied
    .map((room) => `<option value="${escapeAttr(room.id)}">${escapeHtml(room.name)} - ${escapeHtml(room.tenant || "Sin inquilino")}</option>`)
    .join("");
}

function renderRooms(monthPayments, selectedMonth) {
  if (!state.rooms.length) {
    els.roomRows.innerHTML = `<tr><td class="empty" colspan="8">Agrega tu primer cuarto para empezar.</td></tr>`;
    return;
  }

  els.roomRows.innerHTML = state.rooms.map((room) => {
    const paid = monthPayments
      .filter((payment) => payment.roomId === room.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const due = room.status === "occupied" ? Math.max(room.rent - paid, 0) : 0;
    const status = room.status === "available"
      ? `<span class="status free">Disponible</span>`
      : due <= 0
        ? `<span class="status ok">Pagado</span>`
        : `<span class="status pending">Debe ${money.format(due)}</span>`;
    const actions = canWrite()
      ? `${due > 0 ? `<button type="button" onclick="quickPayRoom('${room.id}')">Pagar</button>` : ""}
         <button class="secondary" type="button" onclick="editRoom('${room.id}')">Editar</button>
         <button class="danger" type="button" onclick="deleteRoom('${room.id}')">Eliminar</button>`
      : "";

    return `
      <tr>
        <td><strong>${escapeHtml(room.name)}</strong></td>
        <td>${escapeHtml(room.tenant || "-")}<br><span class="muted">${escapeHtml(room.phone || "")}</span></td>
        <td>${money.format(room.rent)}</td>
        <td>${money.format(paid)}</td>
        <td>${money.format(due)}</td>
        <td>${formatDueDate(selectedMonth, room.dueDay)}</td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join("");
}

function renderPayments(monthPayments) {
  els.paymentCount.textContent = `${monthPayments.length} ${monthPayments.length === 1 ? "registro" : "registros"}`;

  if (!monthPayments.length) {
    els.paymentRows.innerHTML = `<tr><td class="empty" colspan="6">Todavia no hay pagos registrados en este mes.</td></tr>`;
    return;
  }

  els.paymentRows.innerHTML = [...monthPayments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((payment) => {
      const room = state.rooms.find((item) => item.id === payment.roomId);
      const actions = canWrite() ? `<button class="danger" type="button" onclick="deletePayment('${payment.id}')">Eliminar</button>` : "";
      return `
        <tr>
          <td>${formatDate(payment.date)}</td>
          <td>${escapeHtml(room?.name || "Cuarto eliminado")}</td>
          <td>${escapeHtml(room?.tenant || "-")}</td>
          <td>${money.format(payment.amount)}</td>
          <td>${escapeHtml(payment.note || "-")}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join("");
}

function renderUsers() {
  if (!canAdmin()) return;

  els.userRows.innerHTML = state.users
    .map((user) => {
      const deleteButton = user.id === currentUser.id
        ? ""
        : `<button class="danger" type="button" onclick="deleteUser('${user.id}')">Desactivar</button>`;
      return `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.username)}</td>
          <td>${roleLabel(user.role)}</td>
          <td><span class="status ${user.active ? "ok" : "free"}">${user.active ? "Activo" : "Inactivo"}</span></td>
          <td>${user.lastLogin ? formatDateTime(user.lastLogin) : "-"}</td>
          <td>
            <button class="secondary" type="button" onclick="editUser('${user.id}')">Editar</button>
            ${deleteButton}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderReports(monthPayments, selectedMonth) {
  const report = buildMonthlyReport(monthPayments, selectedMonth);

  els.collectionRate.textContent = `${report.collectionRate}%`;
  els.delinquencyRate.textContent = `${report.delinquencyRate}%`;
  els.roomsWithDebt.textContent = String(report.debtRooms.length);
  els.averageRent.textContent = money.format(report.averageRent);
  els.incidentCount.textContent = `${report.incidents.length} ${report.incidents.length === 1 ? "abierta" : "abiertas"}`;
  els.reportMonthLabel.textContent = monthLabel(selectedMonth);
  els.collectionProgressLabel.textContent = `${report.collectionRate}%`;
  els.collectionProgressBar.style.width = `${report.collectionRate}%`;
  els.reportExpected.textContent = money.format(report.expected);
  els.reportPaid.textContent = money.format(report.paid);
  els.reportPending.textContent = money.format(report.pending);
  els.availableRooms.textContent = String(report.availableRooms.length);

  renderIncidentCards(report);
  renderIncidentRows(report);
  renderRecentPayments(report.recentPayments);
}

function renderIncidentCards(report) {
  const cards = [];

  if (report.overdueRooms.length) {
    cards.push({
      level: "critical",
      title: `${report.overdueRooms.length} cuarto${report.overdueRooms.length === 1 ? "" : "s"} con pago vencido`,
      body: `Saldo vencido acumulado: ${money.format(sumBy(report.overdueRooms, "due"))}.`,
    });
  }

  if (report.partialRooms.length) {
    cards.push({
      level: "warning",
      title: `${report.partialRooms.length} pago${report.partialRooms.length === 1 ? "" : "s"} parcial${report.partialRooms.length === 1 ? "" : "es"}`,
      body: "Hay inquilinos que abonaron una parte, pero aun mantienen saldo.",
    });
  }

  if (report.unpaidRooms.length) {
    cards.push({
      level: "critical",
      title: `${report.unpaidRooms.length} cuarto${report.unpaidRooms.length === 1 ? "" : "s"} sin pago registrado`,
      body: "No existe ningun pago cargado para el mes seleccionado.",
    });
  }

  if (report.availableRooms.length) {
    cards.push({
      level: "warning",
      title: `${report.availableRooms.length} cuarto${report.availableRooms.length === 1 ? "" : "s"} disponible${report.availableRooms.length === 1 ? "" : "s"}`,
      body: "Son espacios sin ingreso activo para este mes.",
    });
  }

  if (!cards.length) {
    cards.push({
      level: "ok",
      title: "Sin incidencias abiertas",
      body: "La cobranza del mes esta completa y no hay cuartos disponibles registrados.",
    });
  }

  els.incidentList.innerHTML = cards.map((card) => `
    <article class="incident-card ${card.level}">
      <strong>${escapeHtml(card.title)}</strong>
      <span>${escapeHtml(card.body)}</span>
    </article>
  `).join("");
}

function renderIncidentRows(report) {
  const rows = [...report.debtRooms, ...report.availableRooms.map((room) => ({
    room,
    paid: 0,
    due: 0,
    dueDate: "-",
    incident: "Disponible",
  }))];

  if (!rows.length) {
    els.incidentRows.innerHTML = `<tr><td class="empty" colspan="7">No hay incidencias para el mes seleccionado.</td></tr>`;
    return;
  }

  els.incidentRows.innerHTML = rows.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.room.name)}</strong></td>
      <td>${escapeHtml(item.room.tenant || "-")}</td>
      <td>${typeof item.dueDate === "string" ? item.dueDate : formatDate(dateKey(item.dueDate))}</td>
      <td>${money.format(item.room.rent)}</td>
      <td>${money.format(item.paid)}</td>
      <td>${money.format(item.due)}</td>
      <td><span class="status ${item.incident === "Vencido" ? "pending" : "free"}">${escapeHtml(item.incident)}</span></td>
    </tr>
  `).join("");
}

function renderRecentPayments(recentPayments) {
  els.recentPaymentTotal.textContent = `${recentPayments.length} ${recentPayments.length === 1 ? "pago" : "pagos"}`;

  if (!recentPayments.length) {
    els.recentPaymentRows.innerHTML = `<tr><td class="empty" colspan="5">No hay pagos registrados en este mes.</td></tr>`;
    return;
  }

  els.recentPaymentRows.innerHTML = recentPayments.map((payment) => {
    const room = state.rooms.find((item) => item.id === payment.roomId);
    return `
      <tr>
        <td>${formatDate(payment.date)}</td>
        <td>${escapeHtml(room?.name || "Cuarto eliminado")}</td>
        <td>${escapeHtml(room?.tenant || "-")}</td>
        <td>${money.format(payment.amount)}</td>
        <td>${escapeHtml(payment.note || "-")}</td>
      </tr>
    `;
  }).join("");
}

function buildMonthlyReport(monthPayments, selectedMonth) {
  const occupiedRooms = state.rooms.filter((room) => room.status === "occupied");
  const availableRooms = state.rooms.filter((room) => room.status === "available");
  const expected = occupiedRooms.reduce((sum, room) => sum + room.rent, 0);
  const paid = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const pending = Math.max(expected - paid, 0);
  const today = new Date(`${todayKey()}T00:00:00`);
  const currentMonth = monthKey(today);
  const selectedIsPast = selectedMonth < currentMonth;
  const selectedIsCurrent = selectedMonth === currentMonth;

  const roomStatus = occupiedRooms.map((room) => {
    const roomPaid = monthPayments
      .filter((payment) => payment.roomId === room.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const due = Math.max(room.rent - roomPaid, 0);
    const dueDate = dueDateForMonth(selectedMonth, room.dueDay);
    const isOverdue = due > 0 && (selectedIsPast || (selectedIsCurrent && dueDate < today));
    const incident = due <= 0
      ? "Pagado"
      : isOverdue
        ? "Vencido"
        : roomPaid > 0
          ? "Pago parcial"
          : "Pendiente";

    return { room, paid: roomPaid, due, dueDate, incident };
  });

  const debtRooms = roomStatus.filter((item) => item.due > 0);
  const overdueRooms = roomStatus.filter((item) => item.incident === "Vencido");
  const partialRooms = roomStatus.filter((item) => item.incident === "Pago parcial");
  const unpaidRooms = roomStatus.filter((item) => item.due > 0 && item.paid === 0);
  const incidents = [...debtRooms, ...availableRooms];
  const recentPayments = [...monthPayments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return {
    expected,
    paid,
    pending,
    collectionRate: expected ? Math.min(100, Math.round((paid / expected) * 100)) : 0,
    delinquencyRate: expected ? Math.round((pending / expected) * 100) : 0,
    averageRent: occupiedRooms.length ? expected / occupiedRooms.length : 0,
    availableRooms,
    debtRooms,
    overdueRooms,
    partialRooms,
    unpaidRooms,
    incidents,
    recentPayments,
  };
}

function exportCsv() {
  const selectedMonth = els.monthPicker.value;
  const monthPayments = state.payments.filter((payment) => monthKey(new Date(`${payment.date}T00:00:00`)) === selectedMonth);
  const rows = [["Mes", "Cuarto", "Inquilino", "Alquiler", "Pagado", "Saldo", "Vence", "Estado"]];

  state.rooms.forEach((room) => {
    const paid = monthPayments
      .filter((payment) => payment.roomId === room.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const due = room.status === "occupied" ? Math.max(room.rent - paid, 0) : 0;
    rows.push([
      selectedMonth,
      room.name,
      room.tenant,
      room.rent,
      paid,
      due,
      formatDueDate(selectedMonth, room.dueDay),
      room.status === "available" ? "Disponible" : due <= 0 ? "Pagado" : "Pendiente",
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alquileres-${selectedMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function rowToRoom(row) {
  return {
    id: row.id,
    name: row.name,
    tenant: row.tenant || "",
    phone: row.phone || "",
    rent: Number(row.rent || 0),
    dueDay: Number(row.due_day || 1),
    status: row.status,
  };
}

function roomToRow(room) {
  return {
    name: room.name,
    tenant: room.tenant,
    phone: room.phone,
    rent: room.rent,
    due_day: room.dueDay,
    status: room.status,
  };
}

function rowToPayment(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    date: row.date,
    amount: Number(row.amount || 0),
    note: row.note || "",
  };
}

function profileToUser(profile) {
  return {
    id: profile.id,
    name: profile.name || profile.email,
    username: profile.email,
    role: profile.role,
    active: profile.active,
    lastLogin: profile.last_login,
  };
}

function canAdmin() {
  return currentUser?.role === "admin";
}

function canWrite() {
  return currentUser?.role === "admin" || currentUser?.role === "operator";
}

function roleLabel(role) {
  const roles = {
    admin: "Administrador",
    operator: "Operador",
    viewer: "Solo lectura",
  };
  return roles[role] || role;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });
}

function todayKey() {
  const now = new Date();
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

function paymentDateForMonth(month) {
  const today = new Date();
  if (month === monthKey(today)) return todayKey();

  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.min(today.getDate(), lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}

function dateKey(date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDueDate(month, day) {
  return formatDate(dateKey(dueDateForMonth(month, day)));
}

function dueDateForMonth(month, day) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return new Date(year, monthNumber - 1, Math.min(day, lastDay));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
