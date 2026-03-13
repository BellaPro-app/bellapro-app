const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        console.log('Iniciando Puppeteer...');
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Simular un iPhone 14 Pro Max o similar
        await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
        
        const filePath = 'file:///' + path.resolve(__dirname, '../app.html').replace(/\\/g, '/');
        console.log('Abriendo:', filePath);
        
        await page.goto(filePath, { waitUntil: 'networkidle0' });

        console.log('Inyectando estado y datos de prueba en la UI...');
        // Modificar el DOM en caliente
        await page.evaluate(() => {
            // Ocultar Auth y mostrar App directamente
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            // Actualizar Saludos y Valores
            document.getElementById('dash-greeting').innerText = '¡Hola Ana!';
            document.getElementById('dash-turnos-count').innerText = '3';
            document.getElementById('dash-money').innerText = '$45,500';
            document.getElementById('salon-title-display').innerText = 'BellaStudio Hair';
            
            // Inyectar Turnos Falsos
            const turnosHTML = `
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>10:00 AM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 45 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Corte Femenino + Nutrición</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> María López
                    </div>
                </div>
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>12:30 PM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 120 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Decoloración Global y Tono</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Valeria Gómez
                    </div>
                </div>
                <div class="mini-card" style="opacity:0.6;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>16:00 PM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 30 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Corte Clásico Masculino</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Juan Pérez
                    </div>
                </div>
            `;
            document.getElementById('dash-turnos-list').innerHTML = turnosHTML;
        });

        const assetsPath = path.resolve(__dirname, '../assets');

        // ==== SCREENSHOT 1: HAIR (Base) ====
        console.log('Capturando Hair...');
        await page.screenshot({ path: path.join(assetsPath, 'screenshot-hair.png') });

        // ==== SCREENSHOT 2: NAILS ====
        console.log('Re-configurando para Nails...');
        await page.evaluate(() => {
            document.body.className = 'theme-nails';
            document.getElementById('salon-title-display').innerText = 'Nails Design Pro';
            document.getElementById('dash-money').innerText = '$38,200';
            
            // Re-inyectar turnos enfocados en Nails
            const turnosHTML = `
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>09:30 AM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 90 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Esculpidas Acrílicas Reversa</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Camila R.
                    </div>
                </div>
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>11:00 AM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 60 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Kapping + Esmaltado Semipermanente</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Jésica M.
                    </div>
                </div>
            `;
            document.getElementById('dash-turnos-list').innerHTML = turnosHTML;
        });
        console.log('Capturando Nails...');
        await page.screenshot({ path: path.join(assetsPath, 'screenshot-nails.png') });

        // ==== SCREENSHOT 3: SPA ====
        console.log('Re-configurando para Spa...');
        await page.evaluate(() => {
            document.body.className = 'theme-spa';
            document.getElementById('salon-title-display').innerText = 'Zen Harmony Spa';
            document.getElementById('dash-money').innerText = '$64,000';
            
            // Re-inyectar turnos enfocados en Spa
            const turnosHTML = `
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>14:00 PM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 60 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Masaje Descontracturante</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Pablo G.
                    </div>
                </div>
                <div class="mini-card" style="border-left: 4px solid var(--primary-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>16:00 PM</strong>
                        <span style="font-size:12px; color:var(--text-secondary);"><i class="fas fa-clock"></i> 90 min</span>
                    </div>
                    <div style="font-size:15px; margin-bottom:6px;">Limpieza Facial Profunda HD</div>
                    <div style="font-size:13px; color:var(--text-secondary);">
                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Sofía T.
                    </div>
                </div>
            `;
            document.getElementById('dash-turnos-list').innerHTML = turnosHTML;
        });
        console.log('Capturando Spa...');
        await page.screenshot({ path: path.join(assetsPath, 'screenshot-spa.png') });

        console.log('Todas las capturas generadas existosamente.');
        await browser.close();
    } catch (e) {
        console.error('Error generando capturas:', e);
        process.exit(1);
    }
})();
