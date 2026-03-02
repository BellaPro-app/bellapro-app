const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Webhook para Hotmart - Activación Automática de BellaPro
 * Documentación: https://developers.hotmart.com/docs/es/v1/webhook/introduction/
 */
exports.hotmartWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Verificación básica de seguridad (Hotmart Token)
    // Deberías configurar este token en las variables de entorno de Firebase: 
    // firebase functions:config:set hotmart.token="TU_TOKEN_AQUI"
    const hToken = req.headers["h-hotmart-hottoken"] || req.body.h_hotmart_hottoken;
    const expectedToken = functions.config().hotmart ? functions.config().hotmart.token : null;

    if (expectedToken && hToken !== expectedToken) {
        console.error("Token de Hotmart inválido");
        return res.status(401).send("Unauthorized");
    }

    const data = req.body;
    const event = data.event; // Ej: PURCHASE_APPROVED
    const email = data.data && data.data.buyer ? data.data.buyer.email : null;

    console.log(`Evento recibido de Hotmart: ${event} para el usuario: ${email}`);

    if (event === "PURCHASE_APPROVED" && email) {
        try {
            // Buscamos al usuario en la colección 'users' por su email de compra
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('config.email', '==', email).limit(1).get();

            if (snapshot.empty) {
                // Si el usuario aún no se registró, dejamos una "pre-aprobación" en una colección especial
                // o simplemente guardamos el email aprobado para cuando se registre.
                await db.collection('approved_emails').doc(email).set({
                    approved: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    hotmart_id: data.data.purchase.transaction
                });
                console.log(`Email ${email} pre-aprobado (usuario no registrado aún).`);
            } else {
                // Si ya existe, lo activamos directo
                const userDoc = snapshot.docs[0];
                await userDoc.ref.update({
                    "config.isApproved": true,
                    "config.hotmart_transaction": data.data.purchase.transaction
                });
                console.log(`Usuario ${email} activado automáticamente.`);
            }
            return res.status(200).send("OK");
        } catch (error) {
            console.error("Error procesando Webhook:", error);
            return res.status(500).send("Internal Server Error");
        }
    }

    // Responder siempre 200 a Hotmart para evitar reintentos innecesarios en eventos que no manejamos
    res.status(200).send("Evento recibido, no requiere acción.");
});
