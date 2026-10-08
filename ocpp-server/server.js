/**
 * Serveur OCPP 1.6J (profil JSON) pour BorneApp.
 *
 * - Les bornes se connectent en WebSocket sur ws://HOTE:9220/ocpp/{reference}
 *   (sous-protocole "ocpp1.6") et envoient les messages CALL standard :
 *   BootNotification, Heartbeat, Authorize, StatusNotification, StartTransaction,
 *   StopTransaction, MeterValues, FirmwareStatusNotification,
 *   DiagnosticsStatusNotification.
 * - Chaque événement est relayé à l'API Laravel (routes /api/v1/internal/ocpp/*,
 *   authentifiées par le secret partagé X-Ocpp-Secret).
 * - Un serveur HTTP (port 9221) reçoit les commandes du backend
 *   (RemoteStart/StopTransaction, Reset, UnlockConnector, ChangeConfiguration,
 *   GetConfiguration, UpdateFirmware, GetDiagnostics, SetChargingProfile,
 *   ClearChargingProfile) et les transmet à la borne concernée.
 * - Un relais WebSocket (port 9222, /live?token=...) pousse en temps réel les
 *   événements métier diffusés par Laravel (POST /broadcast) vers le back-office.
 *
 * Lancer : npm start   (variables : LARAVEL_URL, OCPP_SHARED_SECRET)
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

const OCPP_PORT = Number(process.env.OCPP_PORT ?? 9220);
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 9221);
const LIVE_PORT = Number(process.env.LIVE_PORT ?? 9222);
const LARAVEL_URL = process.env.LARAVEL_URL ?? 'http://127.0.0.1:8000/api/v1';
const SECRET = process.env.OCPP_SHARED_SECRET ?? 'borneapp-ocpp-secret-dev';

// Types de message OCPP-J
const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

/** reference borne -> { ws, pending: Map<messageId, resolve> } */
const bornes = new Map();
/** transactionId OCPP -> sessionId Laravel */
const transactions = new Map();

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function versLaravel(path, payload) {
  try {
    const res = await fetch(`${LARAVEL_URL}/internal/ocpp${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Ocpp-Secret': SECRET,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) log(`⚠️ Laravel ${path} → ${res.status}`);
    return res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  } catch (err) {
    log(`⚠️ Laravel injoignable (${path}): ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Serveur WebSocket OCPP (côté bornes)
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({
  port: OCPP_PORT,
  handleProtocols: (protocols) => (protocols.has('ocpp1.6') ? 'ocpp1.6' : false),
});

wss.on('connection', (ws, req) => {
  const match = req.url?.match(/\/ocpp\/(.+)$/);
  if (!match) {
    ws.close(1008, 'URL attendue : /ocpp/{reference}');
    return;
  }
  const reference = decodeURIComponent(match[1]);
  bornes.set(reference, { ws, pending: new Map() });
  log(`🔌 Borne connectée : ${reference}`);
  diffuser('ocpp.connexion', { reference, connectee: true });

  ws.on('message', async (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      await versLaravel('/erreur', { reference, message: 'Trame JSON invalide' });
      return;
    }

    const [type, messageId, actionOuPayload, payload] = frame;

    if (type === CALLRESULT || type === CALLERROR) {
      // Réponse à une de nos commandes (RemoteStart…, Reset…)
      const entry = bornes.get(reference);
      const resolve = entry?.pending.get(messageId);
      if (resolve) {
        entry.pending.delete(messageId);
        resolve(type === CALLRESULT ? actionOuPayload : { errorCode: actionOuPayload, errorDescription: payload });
      }
      if (type === CALLERROR) {
        await versLaravel('/erreur', { reference, message: `${actionOuPayload} ${payload ?? ''}`.trim().slice(0, 240) });
      }
      return;
    }

    if (type !== CALL) return;
    const action = actionOuPayload;
    try {
      const reponse = await traiterAction(reference, action, payload ?? {});
      ws.send(JSON.stringify([CALLRESULT, messageId, reponse]));
    } catch (err) {
      ws.send(JSON.stringify([CALLERROR, messageId, 'InternalError', err.message, {}]));
      await versLaravel('/erreur', { reference, message: `${action} : ${err.message}`.slice(0, 240) });
    }
  });

  ws.on('close', () => {
    bornes.delete(reference);
    log(`❌ Borne déconnectée : ${reference}`);
    diffuser('ocpp.connexion', { reference, connectee: false });
  });
});

async function traiterAction(reference, action, payload) {
  switch (action) {
    case 'BootNotification': {
      const r = await versLaravel('/boot', {
        reference,
        versionFirmware: payload.firmwareVersion ?? null,
        modele: payload.chargePointModel ?? null,
        fabricant: payload.chargePointVendor ?? null,
        numeroSerie: payload.chargePointSerialNumber ?? null,
      });
      return {
        status: r?.status ?? 'Accepted',
        currentTime: new Date().toISOString(),
        interval: r?.interval ?? 30,
      };
    }

    case 'Heartbeat':
      await versLaravel('/heartbeat', {
        reference,
        temperatureC: payload.customTemperature ?? null,
      });
      return { currentTime: new Date().toISOString() };

    case 'StatusNotification':
      await versLaravel('/status', {
        reference,
        connectorId: payload.connectorId ?? 0,
        status: payload.status,
        errorCode: payload.errorCode ?? 'NoError',
        vendorErrorCode: payload.vendorErrorCode ?? null,
        info: payload.info ?? null,
      });
      return {};

    case 'Authorize': {
      const r = await versLaravel('/authorize', { reference, idTag: payload.idTag });
      return { idTagInfo: { status: r?.status ?? 'Invalid' } };
    }

    case 'StartTransaction': {
      // idTag = id de session Laravel (RemoteStart) ou UID d'un badge RFID.
      const r = await versLaravel('/start-transaction', {
        reference,
        connectorId: payload.connectorId,
        idTag: String(payload.idTag),
      });
      if (!r?.sessionId) {
        return { transactionId: 0, idTagInfo: { status: r?.status ?? 'Invalid' } };
      }
      transactions.set(r.sessionId, r.sessionId);
      return { transactionId: r.sessionId, idTagInfo: { status: 'Accepted' } };
    }

    case 'MeterValues': {
      const sessionId = transactions.get(payload.transactionId) ?? payload.transactionId;
      const sample = payload.meterValue?.at(-1)?.sampledValue ?? [];
      const valeur = (mesure) => {
        const v = sample.find((s) => s.measurand === mesure)?.value;
        return v != null ? Number(v) : null;
      };
      if (sessionId) {
        await versLaravel('/meter-values', {
          sessionId,
          energieKwh: (valeur('Energy.Active.Import.Register') ?? 0) / 1000, // Wh → kWh
          puissanceKw: (valeur('Power.Active.Import') ?? 0) / 1000, // W → kW
          pourcentageBatterie: valeur('SoC'),
        });
      }
      return {};
    }

    case 'StopTransaction': {
      const sessionId = transactions.get(payload.transactionId) ?? payload.transactionId;
      transactions.delete(payload.transactionId);
      await versLaravel('/stop-transaction', {
        sessionId,
        energieKwh: payload.meterStop != null ? payload.meterStop / 1000 : null,
      });
      return { idTagInfo: { status: 'Accepted' } };
    }

    case 'FirmwareStatusNotification':
      await versLaravel('/firmware-status', { reference, status: payload.status });
      return {};

    case 'DiagnosticsStatusNotification':
      await versLaravel('/diagnostics-status', { reference, status: payload.status });
      return {};

    default:
      log(`Action OCPP non gérée : ${action}`);
      return {};
  }
}

/** Envoie un CALL à une borne et attend sa réponse (8 s max). */
function commanderBorne(reference, action, payload) {
  const entry = bornes.get(reference);
  if (!entry) return Promise.resolve(null);

  const messageId = Math.random().toString(36).slice(2);
  entry.ws.send(JSON.stringify([CALL, messageId, action, payload]));
  log(`➡️  ${action} → ${reference}`);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      entry.pending.delete(messageId);
      resolve(null);
    }, 8000);
    entry.pending.set(messageId, (reponse) => {
      clearTimeout(timer);
      resolve(reponse);
    });
  });
}

const HORS_LIGNE = { ok: false, message: 'Borne hors ligne.' };

// ---------------------------------------------------------------------------
// Serveur HTTP de commandes (côté backend Laravel)
// ---------------------------------------------------------------------------

const commandes = {
  '/commands/remote-start': async ({ reference, connecteurId, sessionId }) => {
    const r = await commanderBorne(reference, 'RemoteStartTransaction', {
      idTag: String(sessionId),
      connectorId: connecteurId,
    });
    if (!r) return { ok: false, message: 'Borne hors ligne — session en mode simulation.' };
    return r.status === 'Accepted'
      ? { ok: true, message: 'Recharge lancée sur la borne.' }
      : { ok: false, message: 'La borne a refusé le démarrage.' };
  },
  '/commands/remote-stop': async ({ reference, sessionId }) => {
    const r = await commanderBorne(reference, 'RemoteStopTransaction', { transactionId: sessionId });
    if (!r) return HORS_LIGNE;
    return r.status === 'Accepted'
      ? { ok: true, message: 'Arrêt demandé à la borne.' }
      : { ok: false, message: "La borne a refusé l'arrêt." };
  },
  '/commands/reset': async ({ reference, type = 'Soft' }) => {
    const r = await commanderBorne(reference, 'Reset', { type });
    if (!r) return { ok: false, message: 'Borne hors ligne — reset non transmis.' };
    return r.status === 'Accepted'
      ? { ok: true, message: `Reset ${type === 'Hard' ? 'matériel' : 'logiciel'} accepté par la borne.` }
      : { ok: false, message: 'Reset refusé par la borne.' };
  },
  '/commands/unlock': async ({ reference, connecteurId }) => {
    const r = await commanderBorne(reference, 'UnlockConnector', { connectorId: connecteurId });
    if (!r) return HORS_LIGNE;
    return r.status === 'Unlocked'
      ? { ok: true, message: 'Connecteur déverrouillé.' }
      : { ok: false, message: `Déverrouillage refusé (${r.status ?? r.errorCode}).` };
  },
  '/commands/charging-limit': async ({ reference, connecteurId, limiteW }) => {
    // limiteW = null → reprise (ClearChargingProfile), sinon SetChargingProfile (0 = pause).
    const r =
      limiteW == null
        ? await commanderBorne(reference, 'ClearChargingProfile', { id: 1, connectorId: connecteurId })
        : await commanderBorne(reference, 'SetChargingProfile', {
            connectorId: connecteurId,
            csChargingProfiles: {
              chargingProfileId: 1,
              stackLevel: 1,
              chargingProfilePurpose: 'TxProfile',
              chargingProfileKind: 'Relative',
              chargingSchedule: {
                chargingRateUnit: 'W',
                chargingSchedulePeriod: [{ startPeriod: 0, limit: limiteW }],
              },
            },
          });
    if (!r) return HORS_LIGNE;
    return r.status === 'Accepted'
      ? { ok: true, message: limiteW == null ? 'Limite levée.' : `Puissance limitée à ${limiteW / 1000} kW.` }
      : { ok: false, message: `Profil de charge refusé (${r.status ?? r.errorCode}).` };
  },
  '/commands/change-configuration': async ({ reference, key, value }) => {
    const r = await commanderBorne(reference, 'ChangeConfiguration', { key, value });
    if (!r) return HORS_LIGNE;
    const messages = {
      Accepted: `Paramètre ${key} modifié.`,
      RebootRequired: `Paramètre ${key} modifié — redémarrage requis.`,
      Rejected: `Modification de ${key} refusée.`,
      NotSupported: `Paramètre ${key} non supporté par la borne.`,
    };
    return { ok: ['Accepted', 'RebootRequired'].includes(r.status), message: messages[r.status] ?? r.errorCode };
  },
  '/commands/get-configuration': async ({ reference }) => {
    const r = await commanderBorne(reference, 'GetConfiguration', {});
    if (!r) return HORS_LIGNE;
    return {
      ok: true,
      message: `${r.configurationKey?.length ?? 0} paramètre(s) lus.`,
      donnees: r.configurationKey ?? [],
    };
  },
  '/commands/update-firmware': async ({ reference, location, retrieveDate }) => {
    const r = await commanderBorne(reference, 'UpdateFirmware', { location, retrieveDate, retries: 2 });
    return r ? { ok: true, message: 'Mise à jour transmise à la borne.' } : HORS_LIGNE;
  },
  '/commands/get-diagnostics': async ({ reference, location }) => {
    const r = await commanderBorne(reference, 'GetDiagnostics', { location });
    if (!r) return HORS_LIGNE;
    return r.fileName
      ? { ok: true, message: `Diagnostic ${r.fileName} en cours d'envoi.` }
      : { ok: false, message: 'Aucun diagnostic disponible.' };
  },
};

function lireCorps(req) {
  return new Promise((resolve) => {
    let corps = '';
    req.on('data', (chunk) => (corps += chunk));
    req.on('end', () => resolve(corps));
  });
}

http
  .createServer(async (req, res) => {
    const repondre = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.headers['x-ocpp-secret'] !== SECRET) return repondre(401, { message: 'Secret invalide' });

    if (req.method === 'GET' && req.url === '/status') {
      return repondre(200, { bornesConnectees: [...bornes.keys()], clientsTempsReel: clients.size });
    }

    if (req.method === 'POST' && req.url === '/broadcast') {
      try {
        const { evenement, donnees } = JSON.parse((await lireCorps(req)) || '{}');
        diffuser(evenement, donnees);
        return repondre(200, { message: 'Diffusé', clients: clients.size });
      } catch (err) {
        return repondre(400, { message: err.message });
      }
    }

    const commande = commandes[req.url ?? ''];
    if (req.method !== 'POST' || !commande) return repondre(404, { message: 'Commande inconnue' });

    try {
      const resultat = await commande(JSON.parse((await lireCorps(req)) || '{}'));
      repondre(resultat.ok ? 200 : 502, { message: resultat.message, donnees: resultat.donnees ?? null });
    } catch (err) {
      repondre(500, { message: err.message });
    }
  })
  .listen(HTTP_PORT);

// ---------------------------------------------------------------------------
// Relais temps réel vers le back-office (module 4)
// ---------------------------------------------------------------------------

/** ws -> { userId, personnel } */
const clients = new Map();

const live = new WebSocketServer({ port: LIVE_PORT });

live.on('connection', async (ws, req) => {
  const token = new URL(req.url ?? '/', 'http://x').searchParams.get('token');
  // Authentification : le jeton Sanctum est vérifié auprès de Laravel.
  let user = null;
  try {
    const res = await fetch(`${LARAVEL_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    user = res.ok ? await res.json() : null;
  } catch {
    user = null;
  }
  if (!user) {
    ws.close(4401, 'Non authentifié');
    return;
  }

  clients.set(ws, { userId: user.id, personnel: user.role !== 'client' });
  ws.send(JSON.stringify({ evenement: 'connecte', donnees: { bornesConnectees: [...bornes.keys()] } }));
  ws.on('close', () => clients.delete(ws));

  // Keep-alive pour les proxys.
  const ping = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 25000);
  ws.on('close', () => clearInterval(ping));
});

function diffuser(evenement, donnees = {}) {
  const message = JSON.stringify({ evenement, donnees });
  for (const [ws, client] of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    // Un client ne reçoit que ses propres sessions ; le personnel reçoit tout.
    const pourClient =
      evenement === 'borne.maj' || (evenement === 'session.maj' && donnees.userId === client.userId);
    if (client.personnel || pourClient) ws.send(message);
  }
}

log(`⚡ Serveur OCPP 1.6J : ws://0.0.0.0:${OCPP_PORT}/ocpp/{reference}`);
log(`🛠  API commandes    : http://127.0.0.1:${HTTP_PORT}`);
log(`📡 Temps réel       : ws://0.0.0.0:${LIVE_PORT}/live?token=…`);
