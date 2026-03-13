const puppeteer = require('puppeteer');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        console.log('Iniciando Puppeteer...');
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
        
        const filePath = 'file:///' + path.resolve(__dirname, '../app.html').replace(/\\/g, '/');
        console.log('Abriendo:', filePath);
        
        await page.goto(filePath, { waitUntil: 'networkidle0' });

        console.log('Inyectando estado y clases...');
        await page.evaluate(() => {
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.body.className = 'theme-hair';
            document.getElementById('dash-greeting').innerText = '¡Hola Ana!';
        });

        const assetsPath = path.resolve(__dirname, '../assets');

        // ==== SCREENSHOT: Nuevo Turno ====
        console.log('Abriendo modal Nuevo Turno...');
        await page.evaluate(() => {
            document.getElementById('btn-nuevo-turno').click();
        });
        await delay(500); // esperar animación

        await page.evaluate(() => {
            document.getElementById('cliente').value = "Lucía Hernández";
            document.getElementById('servicio-select-form').innerHTML = '<option selected>Alisado Permanente - $25,000</option>';
            document.getElementById('fecha').value = "2026-03-15";
            document.getElementById('hora').value = "15:00";
        });
        
        console.log('Capturando Add Turno...');
        await page.screenshot({ path: path.join(assetsPath, 'screenshot-add-turno.png') });
        
        // Cerrar modal
        await page.evaluate(() => {
            document.querySelector('#modal-nuevo-turno .close-btn').click();
        });
        await delay(500);

        // ==== SCREENSHOT: Finanzas ====
        console.log('Abriendo modal Finanzas...');
        await page.evaluate(() => {
            document.getElementById('dash-money').innerText = '$60,000';
            document.getElementById('btn-finanzas').click();
        });
        await delay(500); // esperar
        
        await page.evaluate(() => {
            const list = document.getElementById('finance-list');
            if(list) {
                list.innerHTML = `
                    <div class="finance-item" style="display:flex; justify-content:space-between; padding: 15px; border-bottom: 1px solid var(--border-color); background: var(--card-bg); border-radius: 12px; margin-bottom: 10px;">
                        <div>
                            <strong style="color:var(--text-main); font-size:16px;">Corte Femenino</strong><br>
                            <small style="color:var(--text-secondary);"><i class="fas fa-calendar"></i> Hoy - Ana Gómez</small>
                        </div>
                        <div style="color:var(--primary-color); font-weight:bold; font-size:16px;">+$15,000</div>
                    </div>
                    <div class="finance-item" style="display:flex; justify-content:space-between; padding: 15px; border-bottom: 1px solid var(--border-color); background: var(--card-bg); border-radius: 12px;">
                        <div>
                            <strong style="color:var(--text-main); font-size:16px;">Decoloración Global</strong><br>
                            <small style="color:var(--text-secondary);"><i class="fas fa-calendar"></i> Hoy - María López</small>
                        </div>
                        <div style="color:var(--primary-color); font-weight:bold; font-size:16px;">+$45,000</div>
                    </div>
                `;
            }
        });

        console.log('Capturando Finanzas...');
        await page.screenshot({ path: path.join(assetsPath, 'screenshot-finanzas.png') });

        console.log('Capturas complementarias generadas existosamente.');
        await browser.close();
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
