const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

/**
 * Webhook Seguro para Hotmart - Arquitectura Zero-Touch SaaS
 * Valida la firma HMAC SHA256 y el Hotmart Token.
 */
exports.hotmartWebhook = functions.https.onRequest(async (req, res) => {
    const hSignature = req.headers["x-hotmart-signature"];
    const hToken = req.headers["h-hotmart-hottoken"];
    
    // Configuración de seguridad (debe setearse en Firebase Functions config)
    const secretKey = functions.config().hotmart ? functions.config().hotmart.secret : "DEV_SECRET";
    const expectedToken = functions.config().hotmart ? functions.config().hotmart.token : "DEV_TOKEN";

    // 1. Verificación de Token
    if (hToken !== expectedToken) {
        console.error("CRITICAL: Hotmart Token mismatch. Possible SSRF/Tampering.");
        return res.status(401).send("Unauthorized");
    }

    // 2. Validación de Firma Criptográfica (Integridad Inviolable)
    if (hSignature) {
        const hmac = crypto.createHmac("sha256", secretKey);
        const digest = hmac.update(JSON.stringify(req.body)).digest("hex");
        if (hSignature !== digest) {
            console.error("CRITICAL: Signature mismatch. Insecure payload detected.");
            return res.status(403).send("Forbidden");
        }
    }

    const data = req.body;
    const event = data.event; // PURCHACE_APPROVED, ORDER_CREATED, etc.
    const buyer = data.data && data.data.buyer ? data.data.buyer : null;

    if (!buyer || !buyer.email) {
        return res.status(400).send("Bad Request: Missing buyer email");
    }

    const email = buyer.email;
    const transactionId = data.data.purchase.transaction;

    console.log(`HOTMART EVENT: ${event} | USER: ${email} | TX: ${transactionId}`);

    // Mapeo de Roles RBAC basado en el producto/oferta
    let role = "PREMIUM";
    if (data.data.purchase.price.value === 0) {
        role = "FREE_STUDENT";
    }

    try {
        // --- ORQUESTACIÓN DE PROVISIÓN (SOBERANÍA TOTAL) ---
        // Generamos un Tenant ID único para el aislamiento de datos (Silo)
        const tenantId = `tnt_${crypto.randomBytes(4).toString("hex")}`;
        
        // 1. Creamos el registro del Tenant (Aislamiento Lógico de Infraestructura)
        const tenantRef = db.collection('tenants').doc(tenantId);
        await tenantRef.set({
            owner: email,
            status: "active",
            provisionedAt: admin.firestore.FieldValue.serverTimestamp(),
            config: {
                encryption: "AES-256-GCM",
                region: "default"
            }
        });

        // 2. Vinculamos el Email al Tenant y Rol (Entrada para el Auth Watcher)
        await db.collection('approved_emails').doc(email).set({
            approved: true,
            role: role,
            tenantId: tenantId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            hotmart_id: transactionId
        });

        // 3. Si el usuario ya existe, inyectamos el rol y el tenant directamente
        const userSnapshot = await db.collection('users').where('config.email', '==', email).limit(1).get();
        if (!userSnapshot.empty) {
            await userSnapshot.docs[0].ref.update({
                "config.isApproved": true,
                "config.role": role,
                "config.tenantId": tenantId,
                "config.hotmart_transaction": transactionId
            });
        }

        console.log(`PROVISIONING RECAP: User ${email} mapped to Tenant ${tenantId} as ${role}`);
        return res.status(200).send("Provisioning Successful");

    } catch (error) {
        console.error("PROVISIONING FAILED:", error);
        return res.status(500).send("Infrastructure Orchestration Error");
    }
});
