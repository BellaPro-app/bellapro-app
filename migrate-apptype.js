/**
 * migrate-apptype.js
 * Script de migración: fija el campo `appType` en documentos de Firestore
 * donde sea null, undefined o falte completamente.
 *
 * Uso:
 *   node migrate-apptype.js          <- DRY RUN (solo loguea, no escribe)
 *   node migrate-apptype.js --apply  <- Escribe los cambios en Firestore
 *
 * Requiere: npm install firebase-admin
 * Requiere: variable de entorno GOOGLE_APPLICATION_CREDENTIALS apuntando al service account JSON
 * (descargarlo desde Firebase Console > Configuración del proyecto > Cuentas de servicio)
 */

const admin = require('firebase-admin');

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
const PROJECT_ID = 'bellapro-d297f';
const DRY_RUN = !process.argv.includes('--apply');

// Colecciones dentro de cada specialty que tienen appType
const COLLECTIONS_WITH_APPTYPE = ['turnos', 'clientes', 'productos', 'pagos'];

// ─── INIT ─────────────────────────────────────────────────────────────────────
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID
});

const db = admin.firestore();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function log(msg) { console.log('[migrate-apptype]', msg); }
function warn(msg) { console.warn('[migrate-apptype] ⚠️', msg); }

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function migrate() {
    log(`Modo: ${DRY_RUN ? '🔍 DRY RUN (sin escritura)' : '✏️ APPLY (escribe en Firestore)'}`);
    log(`Proyecto: ${PROJECT_ID}`);
    log('─'.repeat(60));

    let totalFixed = 0;
    let totalScanned = 0;

    // Iterar todos los usuarios
    const usersSnap = await db.collection('users').get();
    log(`Usuarios encontrados: ${usersSnap.size}`);

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        log(`\nUsuario: ${uid}`);

        // Iterar todas las especialidades de este usuario
        const specialtiesSnap = await db
            .collection('users').doc(uid)
            .collection('specialties').get();

        if (specialtiesSnap.empty) {
            warn(`  Sin sub-colección 'specialties'. Puede ser usuario antiguo.`);
            continue;
        }

        for (const specDoc of specialtiesSnap.docs) {
            const specialty = specDoc.id; // 'hair', 'nails', 'spa'
            log(`  Especialidad: ${specialty}`);

            for (const col of COLLECTIONS_WITH_APPTYPE) {
                const colRef = db
                    .collection('users').doc(uid)
                    .collection('specialties').doc(specialty)
                    .collection(col);

                // Buscar docs sin appType
                const missingSnap = await colRef.where('appType', '==', null).get();
                // También los que directamente no tienen el campo (Firestore no soporta isNull para ausencia)
                // Hacemos un get completo y filtramos en memoria
                const allSnap = await colRef.limit(500).get();

                const docsToFix = allSnap.docs.filter(d => {
                    const data = d.data();
                    return !data.appType || data.appType === null || data.appType === undefined;
                });

                totalScanned += allSnap.size;

                if (docsToFix.length === 0) {
                    log(`    ${col}: ✅ Todos tienen appType (${allSnap.size} docs)`);
                    continue;
                }

                log(`    ${col}: ⚠️  ${docsToFix.length} docs sin appType (de ${allSnap.size} total)`);

                if (!DRY_RUN) {
                    // Actualizar en batches de 500
                    const batch = db.batch();
                    docsToFix.forEach(d => {
                        batch.update(d.ref, { appType: specialty });
                    });
                    await batch.commit();
                    log(`    ${col}: ✏️  ${docsToFix.length} docs actualizados con appType='${specialty}'`);
                } else {
                    log(`    ${col}: [DRY RUN] Se actualizarían ${docsToFix.length} docs con appType='${specialty}'`);
                }

                totalFixed += docsToFix.length;
            }

            // También corregir sub-colección 'turnos' directa en el raíz del usuario (reservas públicas)
            const publicTurnosSnap = await db
                .collection('users').doc(uid)
                .collection('turnos').limit(500).get();

            const publicToFix = publicTurnosSnap.docs.filter(d => !d.data().appType);
            totalScanned += publicTurnosSnap.size;

            if (publicToFix.length > 0) {
                log(`  turnos (públicos, raíz): ⚠️  ${publicToFix.length} docs sin appType`);
                if (!DRY_RUN) {
                    const batch = db.batch();
                    publicToFix.forEach(d => {
                        batch.update(d.ref, { appType: specialty, status: d.data().status || 'pending' });
                    });
                    await batch.commit();
                    log(`  turnos (públicos, raíz): ✏️  ${publicToFix.length} docs actualizados`);
                } else {
                    log(`  turnos (públicos, raíz): [DRY RUN] Se actualizarían ${publicToFix.length} docs`);
                }
                totalFixed += publicToFix.length;
            } else {
                log(`  turnos (públicos, raíz): ✅ Todos tienen appType o vacío`);
            }
        }
    }

    log('\n' + '─'.repeat(60));
    log(`RESUMEN:`);
    log(`  Documentos escaneados: ${totalScanned}`);
    log(`  Documentos ${DRY_RUN ? 'a corregir' : 'corregidos'}: ${totalFixed}`);

    if (DRY_RUN && totalFixed > 0) {
        log('\n  ⚡ Para aplicar los cambios, ejecutá:');
        log('     node migrate-apptype.js --apply');
    }

    process.exit(0);
}

migrate().catch(e => {
    console.error('[migrate-apptype] ERROR FATAL:', e);
    process.exit(1);
});
