// BellaPro Application Logic - Audit Refined

const database = new DB();

const app = {
    state: { turnos: [], clientes: [], productos: [], pagos: [], selDay: '', selTime: '', selSrv: '' },
    user: null,

    async init() {
        console.log("BellaPro: Initializing...");

        // Configuration: Consider moving to dedicated config file in production
        const firebaseConfig = {
            apiKey: "AIzaSyCCFp95pg8x4YAJ4prASufTIywvdbHksPE",
            authDomain: "bellapro-d297f.firebaseapp.com",
            projectId: "bellapro-d297f",
            storageBucket: "bellapro-d297f.firebasestorage.app",
            messagingSenderId: "634527697988",
            appId: "1:634527697988:web:f2de382cf883b906dfc011"
        };

        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

        const urlParams = new URL(window.location.href).searchParams;
        this.demoMode = urlParams.get('demo') === 'true';

        if (this.demoMode) {
            console.log("BellaPro: Modo Demo Iniciando...");
            this.showApp();
            await database.init();
            await this.seed();
            this.events();
            this.render();
            return;
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.user = user;
                this.dbCloud = firebase.firestore();
                this.showApp();
                try {
                    await database.init();
                    await this.pullCloud(); // Sincroniza desde la nube (si existen datos previos)
                    await this.load();
                    // SE QUITA: if (this.state.clientes.length === 0) await this.seed();
                    this.events();
                    this.render();
                } catch (e) {
                    this.handleError("Error de sincronización", "No se pudieron cargar los datos.");
                    console.error("Init error:", e);
                }
            } else {
                this.user = null;
                this.showAuth();
            }
        });
    },

    showApp() {
        const auth = document.getElementById('auth-container');
        const main = document.getElementById('main-app');
        const badge = document.getElementById('demo-badge');

        if (auth) {
            auth.classList.add('hidden');
            auth.style.setProperty('display', 'none', 'important');
        }
        if (main) {
            main.classList.remove('hidden');
            main.style.setProperty('display', 'flex', 'important');
            main.style.opacity = '1';
            main.style.visibility = 'visible';
        }
        if (this.demoMode && badge) {
            badge.classList.remove('hidden');
            badge.style.setProperty('display', 'block', 'important');
        }
    },

    showAuth() {
        const auth = document.getElementById('auth-container');
        const main = document.getElementById('main-app');
        if (auth) {
            auth.classList.remove('hidden');
            auth.style.display = 'flex';
        }
        if (main) {
            main.classList.add('hidden');
            main.style.display = 'none';
        }
    },

    toggleLoading(show) {
        // Implementation for a global loader if element exists
        console.log(`BellaPro: Loading ${show ? 'Start' : 'End'}`);
    },

    handleError(title, msg) {
        alert(`${title}: ${msg}`);
    },

    async login() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        const errEl = document.getElementById('auth-error');
        const btn = document.getElementById('btn-login');

        if (!email || !pass) {
            this.showAuthError("Por favor, completa todos los campos.");
            return;
        }

        btn.innerText = "Verificando...";
        btn.disabled = true;

        try {
            await firebase.auth().signInWithEmailAndPassword(email, pass);
        } catch (error) {
            btn.innerText = "Entrar al Salón";
            btn.disabled = false;
            this.showAuthError("Acceso denegado. Verifica tus credenciales.");
            console.error(error);
        }
    },

    async forgotPassword() {
        const email = document.getElementById('auth-email').value;
        if (!email) {
            this.showAuthError("Ingresa tu email arriba para enviarte el enlace de recuperación.");
            return;
        }

        if (confirm(`¿Enviar un email de recuperación a ${email}?`)) {
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                alert("¡Email enviado! Revisa tu bandeja de entrada (y la carpeta de spam).");
                this.showAuthError(""); // Clear any previous error
            } catch (error) {
                this.showAuthError("Error: No se pudo enviar el email. Verifica que la dirección sea correcta.");
                console.error(error);
            }
        }
    },

    async changePassword() {
        const newPass = prompt("Ingresa tu nueva contraseña (mínimo 6 caracteres):");
        if (!newPass) return;
        if (newPass.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            await firebase.auth().currentUser.updatePassword(newPass);
            alert("¡Contraseña actualizada con éxito!");
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                alert("Por seguridad, debes cerrar sesión y volver a entrar antes de cambiar tu contraseña.");
            } else {
                alert("Error al actualizar la contraseña: " + error.message);
            }
            console.error(error);
        }
    },

    showAuthError(msg) {
        const errEl = document.getElementById('auth-error');
        errEl.innerText = msg;
        errEl.style.display = 'block';
    },

    async logout() {
        if (confirm("¿Cerrar sesión en BellaPro?")) {
            await firebase.auth().signOut();
        }
    },

    async load() {
        const [turnos, clientes, productos, pagos] = await Promise.all([
            database.getAll('turnos'),
            database.getAll('clientes'),
            database.getAll('productos'),
            database.getAll('pago')
        ]);

        this.state.turnos = turnos;
        this.state.clientes = clientes;
        this.state.productos = productos;
        this.state.pagos = pagos;
    },

    events() {
        // Prevent multiple listeners if init called again
        const forms = ['f-turno', 'f-fin', 'f-cli', 'f-prod'];
        forms.forEach(fid => {
            const el = document.getElementById(fid);
            if (el) el.onsubmit = null;
        });

        document.getElementById('f-turno').onsubmit = async (e) => {
            e.preventDefault();
            if (!this.state.selDay || !this.state.selTime || !this.state.selSrv) {
                alert("Elegí servicio, día y hora.");
                return;
            }

            const id = document.getElementById('ft-id').value;
            const sel = document.getElementById('ft-cli');
            const turno = {
                cid: sel.value,
                cname: sel.options[sel.selectedIndex].text,
                srv: this.state.selSrv,
                dat: `${this.state.selDay}T${this.state.selTime}`,
                val: Number(document.getElementById('ft-val').value)
            };

            try {
                if (id) {
                    turno.id = Number(id);
                    await database.put('turnos', turno);
                } else {
                    await database.add('turnos', turno);
                }

                if (turno.val > 0 && !id) {
                    await database.add('pago', {
                        dat: turno.dat.split('T')[0],
                        concept: `Turno: ${turno.cname}`,
                        amt: turno.val,
                        typ: 'ingreso'
                    });
                }

                await this.pushCloud();
                this.closeModal('m-turno');
                e.target.reset();
                await this.load();
                this.render();
            } catch (err) {
                console.error("Error saving turno:", err);
            }
        };

        document.getElementById('f-fin').onsubmit = async (e) => {
            e.preventDefault();
            const mov = {
                dat: new Date().toISOString().split('T')[0],
                typ: document.getElementById('ff-typ').value,
                concept: document.getElementById('ff-con').value,
                amt: Number(document.getElementById('ff-amt').value)
            };
            await database.add('pago', mov);
            await this.pushCloud();
            this.closeModal('m-fin');
            e.target.reset();
            await this.load();
            this.render();
        };

        document.getElementById('f-cli').onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('fc-id').value;
            const cli = {
                nom: document.getElementById('fc-nom').value,
                tel: document.getElementById('fc-tel').value,
                not: document.getElementById('fc-not').value
            };
            if (id) {
                cli.id = Number(id);
                await database.put('clientes', cli);
            } else {
                await database.add('clientes', cli);
            }
            await this.pushCloud();
            this.closeModal('m-cli');
            e.target.reset();
            await this.load();
            this.render();
        };

        document.getElementById('f-prod').onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('fp-id').value;
            const prod = {
                nom: document.getElementById('fp-nom').value,
                sto: Number(document.getElementById('fp-sto').value),
                min: Number(document.getElementById('fp-min').value)
            };
            if (id) {
                prod.id = Number(id);
                await database.put('productos', prod);
            } else {
                await database.add('productos', prod);
            }
            await this.pushCloud();
            this.closeModal('m-prod');
            e.target.reset();
            await this.load();
            this.render();
        };
    },

    navTo(id) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.id === id));
        this.state.section = id;
        this.render();
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;

        if (id.startsWith('m-')) {
            const forms = modal.querySelectorAll('form');
            forms.forEach(f => f.reset());
            modal.querySelectorAll('input[type="hidden"]').forEach(h => h.value = '');
        }

        if (id === 'm-turno') {
            if (this.state.clientes.length === 0) {
                alert("Agregá un cliente primero.");
                this.navTo('clientes');
                return;
            }
            this.genSelectors();
        }
        modal.style.display = 'flex';
    },

    genSelectors() {
        const dayCon = document.getElementById('day-selector');
        const timeCon = document.getElementById('time-selector');
        const srvCon = document.getElementById('service-selector');

        if (!dayCon || !timeCon || !srvCon) return;

        dayCon.innerHTML = '';
        timeCon.innerHTML = '';
        srvCon.innerHTML = '';
        this.state.selDay = '';
        this.state.selTime = '';
        this.state.selSrv = '';

        const services = ['Corte Dama', 'Corte Caballero', 'Coloración', 'Mechas/Balayage', 'Peinado Evento', 'Baño de Crema', 'Alisado', 'Lavado & Secado', 'Manicura', 'Depilación Rostro'];
        services.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerText = s;
            chip.onclick = () => {
                document.querySelectorAll('#service-selector .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.selSrv = s;
            };
            srvCon.appendChild(chip);
        });

        const now = new Date();
        for (let i = 0; i < 14; i++) {
            const d = new Date();
            d.setDate(now.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerText = dayName;
            chip.onclick = () => {
                document.querySelectorAll('#day-selector .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.selDay = iso;
            };
            dayCon.appendChild(chip);
        }

        const slots = [];
        for (let h = 9; h <= 20; h++) {
            ['00', '30'].forEach(m => slots.push(`${h.toString().padStart(2, '0')}:${m}`));
        }
        slots.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'chip-time';
            chip.innerText = s;
            chip.onclick = () => {
                document.querySelectorAll('#time-selector .chip-time').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.selTime = s;
            };
            timeCon.appendChild(chip);
        });
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    },

    render() {
        this.renderDashboard();
        this.renderTurnos();
        this.renderClientes();
        this.renderStock();
        this.renderFinanzas();
        this.populateClients();

        const name = localStorage.getItem('bp_name') || 'BellaPro';
        const logo = localStorage.getItem('bp_logo') || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150';

        const titleEl = document.getElementById('salon-title-display');
        const cfgNameEl = document.getElementById('cfg-name');
        const logoEl = document.getElementById('salon-logo-display');
        const previewEl = document.getElementById('cfg-logo-preview');

        if (titleEl) titleEl.innerText = name;
        if (cfgNameEl) cfgNameEl.value = name;
        if (logoEl) logoEl.src = logo;
        if (previewEl) previewEl.src = logo;
    },

    renderDashboard() {
        const hour = new Date().getHours();
        let greet = "¡Buen día!";
        if (hour >= 13) greet = "¡Buenas tardes!";
        if (hour >= 20) greet = "¡Buenas noches!";

        const greetEl = document.getElementById('dash-greeting');
        if (greetEl) greetEl.innerText = greet;

        const today = new Date().toISOString().split('T')[0];
        const list = this.state.turnos.filter(t => t.dat.startsWith(today));
        const countEl = document.getElementById('dash-turnos-count');
        if (countEl) countEl.innerText = list.length;

        const scroll = document.getElementById('dash-turnos-list');
        if (!scroll) return;

        scroll.innerHTML = '';
        if (list.length === 0) {
            scroll.innerHTML = '<p style="opacity:0.3; padding:10px;">Sin turnos para hoy.</p>';
        } else {
            list.sort((a, b) => a.dat.localeCompare(b.dat)).forEach(t => {
                const d = document.createElement('div');
                d.className = 'mini-card';
                d.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="font-weight:700;">${t.cname}</div>
                        <div style="display:flex; gap:10px;">
                            <button onclick="app.sendTicket(${t.id})" aria-label="Ticket" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px;"><i class="fas fa-file-invoice-dollar"></i></button>
                            <button onclick="app.sendWsp(${t.id})" aria-label="WhatsApp" style="background:none; border:none; color:#25D366; cursor:pointer; font-size:16px;"><i class="fab fa-whatsapp"></i></button>
                        </div>
                    </div>
                    <div style="font-size:13px; color:var(--primary-color);">${t.srv}</div>
                    <div style="margin-top:10px; opacity:0.5; font-size:12px;">${t.dat.split('T')[1]} hs</div>
                `;
                scroll.appendChild(d);
            });
        }

        const last7Days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }
        const weeklyIncome = this.state.pagos
            .filter(p => (!p.typ || p.typ === 'ingreso') && last7Days.includes(p.dat))
            .reduce((acc, p) => acc + p.amt, 0);
        const moneyEl = document.getElementById('dash-money');
        if (moneyEl) moneyEl.innerText = `$${weeklyIncome.toLocaleString()}`;
    },

    renderTurnos() {
        const l = document.getElementById('full-turnos-list');
        if (!l) return;
        l.innerHTML = '';
        if (this.state.turnos.length === 0) {
            l.innerHTML = '<p style="opacity:0.3; text-align:center; padding:40px;">No hay turnos registrados aún.</p>';
            return;
        }
        [...this.state.turnos].sort((a, b) => b.dat.localeCompare(a.dat)).forEach(t => {
            const row = document.createElement('div');
            row.className = 'list-item';
            row.innerHTML = `
                <div class="list-item-info">
                    <h4>${t.cname}</h4>
                    <p>${t.dat.replace('T', ' ')} hs - ${t.srv}</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <div style="color:var(--success); font-weight:700; margin-right:15px;">$${t.val.toLocaleString()}</div>
                    <button onclick="app.sendTicket(${t.id})" title="Enviar Ticket" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-right:10px; font-size:16px;"><i class="fas fa-file-invoice-dollar"></i></button>
                    <button onclick="app.sendWsp(${t.id})" title="Recordatorio" style="background:none; border:none; color:#25D366; cursor:pointer; margin-right:10px; font-size:18px;"><i class="fab fa-whatsapp"></i></button>
                    <button onclick="app.prepEditTurno(${t.id})" title="Editar" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-right:10px;"><i class="fas fa-edit"></i></button>
                    <button onclick="app.delItem('turnos', ${t.id})" title="Eliminar" style="background:none; border:none; color:var(--error); cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            l.appendChild(row);
        });
    },

    renderClientes() {
        const l = document.getElementById('full-clientes-list');
        if (!l) return;
        l.innerHTML = '';
        if (this.state.clientes.length === 0) {
            l.innerHTML = '<p style="opacity:0.3; text-align:center; padding:40px;">No hay clientes registrados.</p>';
            return;
        }
        this.state.clientes.forEach(c => {
            const row = document.createElement('div');
            row.className = 'list-item';
            row.innerHTML = `
                <div class="list-item-info">
                    <h4>${c.nom}</h4>
                    <p><i class="fas fa-phone"></i> ${c.tel || 'S/T'}</p>
                </div>
                <div style="display:flex;">
                    <button onclick="app.prepEditCliente(${c.id})" title="Editar" style="background:none; border:none; color:var(--text-secondary); margin-right:10px;"><i class="fas fa-edit"></i></button>
                    <button onclick="app.delItem('clientes', ${c.id})" title="Eliminar" style="background:none; border:none; color:var(--error);"><i class="fas fa-trash"></i></button>
                </div>
            `;
            l.appendChild(row);
        });
    },

    renderStock() {
        const l = document.getElementById('full-stock-list');
        if (!l) return;
        l.innerHTML = '';
        if (this.state.productos.length === 0) {
            l.innerHTML = '<p style="opacity:0.3; text-align:center; padding:40px;">Inventario vacío.</p>';
            return;
        }
        this.state.productos.forEach(p => {
            const row = document.createElement('div');
            row.className = 'list-item';
            row.innerHTML = `
                <div class="list-item-info">
                    <h4>${p.nom}</h4>
                    <p>Referencia stock: ${p.min} min</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <div style="font-size:20px; font-weight:700; color: ${p.sto <= p.min ? 'var(--error)' : 'var(--success)'}; margin-right:15px;">${p.sto}</div>
                    <button onclick="app.prepEditProducto(${p.id})" title="Editar" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-right:10px;"><i class="fas fa-edit"></i></button>
                    <button onclick="app.delItem('productos', ${p.id})" title="Eliminar" style="background:none; border:none; color:var(--error); cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            l.appendChild(row);
        });
    },

    renderFinanzas() {
        const ingresos = this.state.pagos.filter(p => !p.typ || p.typ === 'ingreso').reduce((acc, p) => acc + p.amt, 0);
        const gastos = this.state.pagos.filter(p => p.typ === 'gasto').reduce((acc, p) => acc + p.amt, 0);
        const neto = ingresos - gastos;

        const ingEl = document.getElementById('fin-ing');
        const gasEl = document.getElementById('fin-gas');
        const netoEl = document.getElementById('fin-neto');

        if (ingEl) ingEl.innerText = `$${ingresos.toLocaleString()}`;
        if (gasEl) gasEl.innerText = `$${gastos.toLocaleString()}`;
        if (netoEl) netoEl.innerText = `$${neto.toLocaleString()}`;

        const chartCon = document.getElementById('fin-chart');
        if (!chartCon) return;

        chartCon.innerHTML = '';
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const chartData = days.map(day => {
            const total = this.state.pagos
                .filter(p => p.dat === day && (!p.typ || p.typ === 'ingreso'))
                .reduce((acc, p) => acc + p.amt, 0);
            return { day, total };
        });

        const maxVal = Math.max(...chartData.map(d => d.total), 1000);

        chartData.forEach(d => {
            const height = (d.total / maxVal) * 100;
            const dateObj = new Date(d.day + 'T00:00:00');
            const label = dateObj.toLocaleDateString('es', { weekday: 'short' }).replace('.', '');

            const barWrap = document.createElement('div');
            barWrap.className = 'chart-bar-wrap';
            barWrap.innerHTML = `
                <div class="chart-bar" style="height: ${Math.max(height, 5)}%" data-value="$${d.total.toLocaleString()}"></div>
                <div class="chart-label">${label}</div>
            `;
            chartCon.appendChild(barWrap);
        });

        const l = document.getElementById('full-finanzas-list');
        if (!l) return;
        l.innerHTML = '';
        if (this.state.pagos.length === 0) {
            l.innerHTML = '<p style="opacity:0.3; text-align:center; padding:20px;">Sin movimientos recientes.</p>';
            return;
        }
        [...this.state.pagos].reverse().forEach(p => {
            const row = document.createElement('div');
            row.className = 'list-item';
            const isGasto = p.typ === 'gasto';
            row.innerHTML = `
                <div class="list-item-info">
                    <h4>${p.concept}</h4>
                    <p>${p.dat}</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <div style="color:${isGasto ? 'var(--error)' : 'var(--success)'}; font-weight:700; margin-right:15px;">
                        ${isGasto ? '-' : '+'}$${p.amt.toLocaleString()}
                    </div>
                    <button onclick="app.delItem('pago', ${p.id})" title="Eliminar" style="background:none; border:none; color:var(--error); cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            l.appendChild(row);
        });
    },

    populateClients() {
        const s = document.getElementById('ft-cli');
        if (!s) return;
        s.innerHTML = '<option value="">Seleccionar cliente...</option>';
        this.state.clientes.forEach(c => {
            const o = document.createElement('option');
            o.value = c.id;
            o.innerText = c.nom;
            s.appendChild(o);
        });
    },

    prepEditTurno(id) {
        const t = this.state.turnos.find(x => x.id === id);
        if (!t) return;
        this.openModal('m-turno');
        document.getElementById('ft-id').value = t.id;
        document.getElementById('ft-cli').value = t.cid;
        document.getElementById('ft-val').value = t.val;

        this.state.selSrv = t.srv;
        document.querySelectorAll('#service-selector .chip').forEach(c => {
            if (c.innerText === t.srv) c.classList.add('active');
        });
        const [date, time] = t.dat.split('T');
        this.state.selDay = date;
        this.state.selTime = time;
    },

    prepEditCliente(id) {
        const c = this.state.clientes.find(x => x.id === id);
        if (!c) return;
        this.openModal('m-cli');
        document.getElementById('fc-id').value = c.id;
        document.getElementById('fc-nom').value = c.nom;
        document.getElementById('fc-tel').value = c.tel;
        document.getElementById('fc-not').value = c.not;
    },

    prepEditProducto(id) {
        const p = this.state.productos.find(x => x.id === id);
        if (!p) return;
        this.openModal('m-prod');
        document.getElementById('fp-id').value = p.id;
        document.getElementById('fp-nom').value = p.nom;
        document.getElementById('fp-sto').value = p.sto;
        document.getElementById('fp-min').value = p.min;
    },

    async pushCloud() {
        if (!this.user || this.demoMode) return;
        const data = await database.dump();
        const config = {
            name: localStorage.getItem('bp_name') || 'BellaPro',
            logo: localStorage.getItem('bp_logo') || ''
        };
        try {
            await this.dbCloud.collection('users').doc(this.user.uid).set({
                data,
                config,
                lastSync: new Date().toISOString()
            });
            console.log("Cloud Sync: Push success");
        } catch (e) {
            console.error("Cloud Sync: Push failed", e);
        }
    },

    async pullCloud() {
        if (!this.user) return;
        try {
            const doc = await this.dbCloud.collection('users').doc(this.user.uid).get();
            if (doc.exists) {
                const cloud = doc.data();
                // Check if cloud data is newer or if local is empty
                if (cloud.data) {
                    const stores = ['turnos', 'clientes', 'productos', 'pago'];
                    for (const s of stores) {
                        const items = cloud.data[s] || [];
                        // Simple overwrite for now
                        const tx = database.db.transaction(s, 'readwrite');
                        tx.objectStore(s).clear();
                        for (const item of items) {
                            tx.objectStore(s).add(item);
                        }
                    }
                }
                if (cloud.config) {
                    localStorage.setItem('bp_name', cloud.config.name);
                    if (cloud.config.logo) localStorage.setItem('bp_logo', cloud.config.logo);
                }
                console.log("Cloud Sync: Pull success");
            }
        } catch (e) {
            console.error("Cloud Sync: Pull failed", e);
        }
    },

    async delItem(s, id) {
        if (confirm("¿Seguro que deseas eliminar este elemento?")) {
            await database.del(s, id);
            await this.pushCloud();
            await this.load();
            this.render();
        }
    },

    saveCfg() {
        const name = document.getElementById('cfg-name').value;
        if (name) {
            localStorage.setItem('bp_name', name);
            this.render();
            this.pushCloud().then(() => alert("Configuración guardada y sincronizada!"));
        }
    },

    handleLogo(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem('bp_logo', e.target.result);
            this.render();
        };
        reader.readAsDataURL(file);
    },

    async exportData() {
        const data = {
            version: 1,
            date: new Date().toISOString(),
            turnos: await database.getAll('turnos'),
            clientes: await database.getAll('clientes'),
            productos: await database.getAll('productos'),
            pagos: await database.getAll('pago'),
            config: { salon: localStorage.getItem('bp_name') || 'BellaPro' }
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BellaPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!confirm("Esto reemplazará los datos actuales si hay conflictos. ¿Continuar?")) return;

                // Clear and repopulate
                const stores = ['turnos', 'clientes', 'productos', 'pago'];
                for (const store of stores) {
                    const items = data[store] || data[store === 'pago' ? 'pagos' : store] || [];
                    for (const item of items) {
                        delete item.id; // Let auto-increment handle it
                        await database.add(store, item);
                    }
                }

                alert("Datos importados con éxito. La página se recargará.");
                location.reload();
            } catch (err) {
                alert("Error al leer el archivo. Asegúrate que sea un backup de BellaPro válido.");
            }
        };
        reader.readAsText(file);
    },

    async sendWsp(id) {
        const t = this.state.turnos.find(x => x.id === id);
        if (!t) return;
        const c = this.state.clientes.find(x => x.id == t.cid);
        if (!c || !c.tel) { alert("El cliente no tiene un teléfono válido registrado."); return; }

        const salon = localStorage.getItem('bp_name') || 'BellaPro';
        const [fecha, hora] = t.dat.split('T');
        const [y, m, d] = fecha.split('-');
        const msj = `¡Hola ${c.nom}! Te recuerdo tu turno de *${t.srv}* para el día *${d}/${m}* a las *${hora} hs* en *${salon}*. ¡Te esperamos! ✂️✨`;
        window.open(`https://api.whatsapp.com/send?phone=${c.tel.replace(/\D/g, '')}&text=${encodeURIComponent(msj)}`, '_blank');
    },

    async sendTicket(id) {
        const t = this.state.turnos.find(x => x.id === id);
        if (!t) return;
        const c = this.state.clientes.find(x => x.id == t.cid);
        if (!c || !c.tel) { alert("El cliente no tiene un teléfono válido registrado."); return; }

        const salon = localStorage.getItem('bp_name') || 'BellaPro';
        const [fecha, hora] = t.dat.split('T');
        const [y, m, d] = fecha.split('-');
        const msj = `📄 *COMPROBANTE DE SERVICIO*\n----------------------------------\n🏠 *${salon}*\n👤 *Cliente:* ${c.nom}\n✂️ *Servicio:* ${t.srv}\n📅 *Fecha:* ${d}/${m} - ${hora}hs\n\n💰 *TOTAL:* $${t.val.toLocaleString()}\n----------------------------------\n¡Gracias por elegirnos! ✨`;
        window.open(`https://api.whatsapp.com/send?phone=${c.tel.replace(/\D/g, '')}&text=${encodeURIComponent(msj)}`, '_blank');
    },

    async resetDB() {
        if (!confirm("🚨 ¿ESTÁS TOTALMENTE SEGURO? Esta acción borrará todos tus datos permanentemente.")) return;
        try {
            const stores = ['turnos', 'clientes', 'productos', 'pago'];
            const tx = database.db.transaction(stores, 'readwrite');
            stores.forEach(s => tx.objectStore(s).clear());
            tx.oncomplete = () => {
                alert("Base de datos reseteada con éxito.");
                location.reload();
            };
        } catch (err) {
            console.error("Reset error:", err);
            alert("No se pudo resetear la base de datos.");
        }
    },

    async seed() {
        console.log("BellaPro: Seeding initial data...");
        const cid = await database.add('clientes', { nom: 'María Pérez', tel: '1122334455', not: 'Servicio recurrente' });
        await database.add('productos', { nom: 'Shampoo Profesional 1L', sto: 12, min: 5 });
        await database.add('turnos', {
            cid,
            cname: 'María Pérez',
            srv: 'Corte & Lavado',
            dat: new Date().toISOString().split('T')[0] + 'T10:00',
            val: 8500
        });
        await database.add('pago', {
            dat: new Date().toISOString().split('T')[0],
            concept: 'Ingreso inicial sembrado',
            amt: 8500,
            typ: 'ingreso'
        });
        await this.load();
    }
};

window.onload = () => {
    app.init();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("BellaPro: Service Worker Active"))
            .catch(e => console.error('BellaPro: SW Error', e));
    }
};
