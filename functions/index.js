const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { CloudTasksClient } = require("@google-cloud/tasks");
const logger = require("./shared/logger");
const cookieParser = require("cookie-parser")();

admin.initializeApp();
const db = admin.firestore();

/**
 * Middleware para habilitar cookies en Firebase Functions
 */
const withCookies = (handler) => (req, res) => {
    cookieParser(req, res, () => handler(req, res));
};

/**
 * Webhook Seguro para Hotmart - Arquitectura Desacoplada (Queued)
 * Recibe el evento y lo encola para procesamiento asíncrono.
 */
exports.hotmartWebhook = functions.https.onRequest(async (req, res) => {
    const hSignature = req.headers["x-hotmart-signature"];
    const hToken = req.headers["h-hotmart-hottoken"];
    
    const secretKey = functions.config().hotmart ? functions.config().hotmart.secret : "DEV_SECRET";
    const expectedToken = functions.config().hotmart ? functions.config().hotmart.token : "DEV_TOKEN";

    // 1. Verificación de Token
    if (hToken !== expectedToken) {
        logger.error("Hotmart Token mismatch", { headers: req.headers });
        return res.status(401).send("Unauthorized");
    }

    // 2. Validación de Firma
    if (hSignature) {
        const hmac = crypto.createHmac("sha256", secretKey);
        const digest = hmac.update(JSON.stringify(req.body)).digest("hex");
        if (hSignature !== digest) {
            logger.error("Signature mismatch", { body: req.body });
            return res.status(403).send("Forbidden");
        }
    }

    // 3. Encolar Tarea (Desacoplamiento)
    try {
        const client = new CloudTasksClient();
        const project = process.env.GCLOUD_PROJECT;
        const location = "us-central1"; // O la región de tus funciones
        const queue = "provisioning-queue";
        const url = `https://${location}-${project}.cloudfunctions.net/processProvisioningTask`;

        const parent = client.queuePath(project, location, queue);
        const task = {
            httpRequest: {
                httpMethod: "POST",
                url,
                body: Buffer.from(JSON.stringify(req.body)).toString("base64"),
                headers: { "Content-Type": "application/json" },
            },
        };

        await client.createTask({ parent, task });
        logger.info("Task enqueued for provisioning", { email: req.body.data?.buyer?.email });
        return res.status(202).send("Accepted");
    } catch (error) {
        logger.error("Failed to enqueue task", { error: error.message });
        return res.status(500).send("Internal Server Error");
    }
});

/**
 * Worker: Procesa la provisión de cuentas de forma resiliente.
 */
exports.processProvisioningTask = functions.https.onRequest(async (req, res) => {
    const data = req.body;
    const event = data.event;
    const buyer = data.data && data.data.buyer ? data.data.buyer : null;

    if (!buyer || !buyer.email) {
        logger.warn("Task skipped: Missing buyer email", { data });
        return res.status(200).send("Skipped");
    }

    const email = buyer.email;
    const transactionId = data.data && data.data.purchase ? data.data.purchase.transaction : "manual_tx";

    try {
        const tenantId = `tnt_${crypto.randomBytes(4).toString("hex")}`;
        let role = "PREMIUM";
        if (data.data && data.data.purchase && data.data.purchase.price && data.data.purchase.price.value === 0) {
            role = "FREE_STUDENT";
        }

        const batch = db.batch();

        const tenantRef = db.collection('tenants').doc(tenantId);
        batch.set(tenantRef, {
            owner: email,
            status: "active",
            provisionedAt: admin.firestore.FieldValue.serverTimestamp(),
            config: { encryption: "AES-256-GCM", region: "default" }
        });

        const approvedRef = db.collection('approved_emails').doc(email);
        batch.set(approvedRef, {
            approved: true,
            role: role,
            tenantId: tenantId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            hotmart_id: transactionId
        });

        const userSnapshot = await db.collection('users').where('config.email', '==', email).limit(1).get();
        if (!userSnapshot.empty) {
            batch.update(userSnapshot.docs[0].ref, {
                "config.isApproved": true,
                "config.role": role,
                "config.tenantId": tenantId,
                "config.hotmart_transaction": transactionId
            });
        }

        await batch.commit();
        logger.info("Provisioning Successful", { email, tenantId, role });
        return res.status(200).send("Done");

    } catch (error) {
        logger.error("PROVISIONING FAILED", { email, error: error.message });
        return res.status(500).send("Retry needed");
    }
});

/**
 * Backup Diario Automatizado de Firestore hacia GCS
 */
exports.scheduledFirestoreBackup = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const projectId = process.env.GCLOUD_PROJECT;
        const databaseName = admin.firestore()._databaseId || `(default)`;
        const bucket = `gs://${projectId}-backups`;

        try {
            const client = new admin.firestore.v1.FirestoreAdminClient();
            await client.exportDocuments({
                name: `projects/${projectId}/databases/${databaseName}`,
                outputUriPrefix: bucket,
                collectionIds: [] // Exporta todo
            });
            logger.info("Daily Backup Started", { bucket });
        } catch (error) {
            logger.error("Daily Backup Failed", { error: error.message });
        }
    });

/**
 * Crea una Cookie de Sesión HTTP-Only persistente
 */
exports.createSessionCookie = functions.https.onRequest(withCookies(async (req, res) => {
    const idToken = req.body.idToken;
    const expiresIn = 60 * 60 * 24 * 14 * 1000;

    try {
        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
        const options = { maxAge: expiresIn, httpOnly: true, secure: true, sameSite: 'None' };
        res.cookie('__session', sessionCookie, options);
        logger.info("Session cookie created", { uid: idToken.substring(0, 10) });
        res.status(200).send({ status: 'success' });
    } catch (error) {
        logger.error("createSessionCookie failed", { error: error.message });
        res.status(401).send("Unauthorized");
    }
}));

/**
 * Restaura los datos críticos del usuario si LocalStorage fue purgado.
 */
exports.restoreSessionData = functions.https.onRequest(withCookies(async (req, res) => {
    const sessionCookie = req.cookies?.__session || '';
    
    try {
        const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
        const userDoc = await db.collection('users').doc(decodedClaims.uid).get();
        
        if (!userDoc.exists) {
            return res.status(404).send("User not found");
        }

        const userData = userDoc.data();
        logger.info("Session restored", { uid: decodedClaims.uid });
        res.status(200).send({
            specialty: userData.config.licenseType || 'hair',
            name: userData.config.name,
            email: userData.config.email
        });
    } catch (error) {
        logger.warn("Restore session failed or expired", { error: error.message });
        res.status(401).send("Unauthorized");
    }
}));
