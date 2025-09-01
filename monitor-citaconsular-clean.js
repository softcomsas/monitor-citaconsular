// monitor-citaconsular.js
// ------------------------------------------------------------
// Monitor para citaconsular.es con Webshare.io usando request-promise
// - 1) GET: extrae token del HTML (<input name="token" value="...">)
// - 2) POST: envía token (x-www-form-urlencoded)
// - 3) Parsea agendas/dates del objeto JS bkt_init_widget
// - 4) Alerta si hay elementos en agendas o dates (log + webhook opcional)
// - 5) Ejecuta cada INTERVAL_MS usando proxy de Webshare.io
// ------------------------------------------------------------

require('dotenv').config();

const request = require('request-promise');
const cheerio = require('cheerio');

// ===== Config =====
const GET_URL =
  process.env.GET_URL ||
  'https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048';
const POST_URL = process.env.POST_URL || GET_URL;

const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '60000', 10); // 1 min por defecto

// Headers (simulan navegador; ajustables por .env)
const BASE_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'es-ES,es;q=0.9',
  'cache-control': 'max-age=0',
  'upgrade-insecure-requests': '1',
  'user-agent':
    process.env.UA ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  priority: 'u=0, i',
};

const GET_HEADERS = {
  ...BASE_HEADERS,
  referer: process.env.GET_REFERER || 'https://www.exteriores.gob.es/',
};

const POST_HEADERS = {
  ...BASE_HEADERS,
  referer: process.env.POST_REFERER || GET_URL,
  origin: 'https://www.citaconsular.es',
  'content-type': 'application/x-www-form-urlencoded',
};

// Cookies fijas opcionales
const FIXED_COOKIE = process.env.COOKIE || '';

// Webhook opcional para alertas
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';

// ===== Webshare.io Configuration =====
const WEBSHARE_USERNAME = process.env.WEBSHARE_USERNAME || '';
const WEBSHARE_PASSWORD = process.env.WEBSHARE_PASSWORD || '';
const WEBSHARE_ENDPOINT = process.env.WEBSHARE_ENDPOINT || '23.95.150.145:6114';

// ===== Estado =====
let callCount = 0;
const useWebshare = WEBSHARE_USERNAME && WEBSHARE_PASSWORD;

// ===== Helpers =====
function log(msg, ...rest) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`, ...rest);
}

function buildWebshareProxyUrl() {
  if (!WEBSHARE_USERNAME || !WEBSHARE_PASSWORD) {
    return null;
  }
  return `http://${WEBSHARE_USERNAME}:${WEBSHARE_PASSWORD}@${WEBSHARE_ENDPOINT}`;
}

function currentProxyString() {
  if (useWebshare) {
    return `Webshare.io (${WEBSHARE_ENDPOINT})`;
  }
  return 'SIN PROXY';
}

function buildHttpClient() {
  const options = {
    timeout: 20000,
    followRedirect: true,
    gzip: true,
    jar: true, // Enable cookie jar
  };

  // Configurar proxy
  if (useWebshare) {
    const proxyUrl = buildWebshareProxyUrl();
    if (proxyUrl) {
      options.proxy = proxyUrl;
    }
  }

  return options;
}

// Extrae el token del HTML del primer GET: <input type="hidden" name="token" value="...">
function extractTokenFromHtml(html) {
  const $ = cheerio.load(html);
  const t = $('input[name="token"]').attr('value');
  if (!t) throw new Error("No se encontró input[name='token'] en el HTML inicial");
  return t;
}

// Extrae arrays agendas y dates de la definición JS de bkt_init_widget
function extractArraysFromSecondHtml(html) {
  const mAgendas = html.match(/agendas:\s*(\[[\s\S]*?\])/);
  const mDates = html.match(/dates:\s*(\[[\s\S]*?\])/);

  const parseArray = (src) => {
    if (!src) return [];
    let txt = src[1]
      .replace(/'/g, '"')
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    try {
      return JSON.parse(txt);
    } catch {
      if (/\[\s*\]/.test(src[1])) return [];
      throw new Error('No se pudo parsear el array: ' + src[1].slice(0, 120) + '...');
    }
  };

  const agendas = parseArray(mAgendas);
  const dates = parseArray(mDates);
  return { agendas, dates };
}

async function sendAlert(payload) {
  log('🚨 ALERTA → Hay cupos/fechas!', payload);
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await request.post({
      url: ALERT_WEBHOOK_URL,
      json: payload,
      timeout: 10000,
    });
  } catch (e) {
    log('⚠️  Error enviando webhook de alerta:', e.message);
  }
}

// ===== Ciclo principal =====
async function cycleOnce() {
  callCount += 1;
  
  const requestOptions = buildHttpClient();
  log(`🚀 Ciclo #${callCount} (proxy=${currentProxyString()}) iniciando...`);

  try {
    // 1) GET para obtener token
    const getResp = await request.get({
      url: GET_URL,
      headers: {
        ...GET_HEADERS,
        ...(FIXED_COOKIE ? { Cookie: FIXED_COOKIE } : {})
      },
      ...requestOptions
    });
    
    const token = extractTokenFromHtml(getResp);
    log(`🔐 Token obtenido: ${token}`);

    // 2) POST con token (x-www-form-urlencoded)
    const postResp = await request.post({
      url: POST_URL,
      headers: {
        ...POST_HEADERS,
        ...(FIXED_COOKIE ? { Cookie: FIXED_COOKIE } : {})
      },
      form: { token },
      ...requestOptions
    });

    // 3) Parse agendas/dates
    const { agendas, dates } = extractArraysFromSecondHtml(postResp);
    const agendasCount = Array.isArray(agendas) ? agendas.length : 0;
    const datesCount = Array.isArray(dates) ? dates.length : 0;

    if (agendasCount > 0 || datesCount > 0) {
      log(`❗ Detectado contenido: agendas=${agendasCount}, dates=${datesCount}`);
      await sendAlert({
        agendasCount,
        datesCount,
        agendas,
        dates,
        when: new Date().toISOString(),
        proxy: currentProxyString(),
      });
    } else {
      log('✅ Sin cambios: agendas=[] y dates=[]');
    }
    
  } catch (err) {
    log(`💥 Error ciclo #${callCount}: ${err.message}`);
  }
}

// ===== Arranque =====
(async () => {
  if (!GET_URL || !POST_URL) {
    console.error('Faltan GET_URL o POST_URL en .env');
    process.exit(1);
  }

  if (useWebshare) {
    if (!WEBSHARE_USERNAME || !WEBSHARE_PASSWORD) {
      console.error('Faltan WEBSHARE_USERNAME o WEBSHARE_PASSWORD en .env para usar Webshare.io');
      process.exit(1);
    }
    log(`🌐 Usando Webshare.io: ${WEBSHARE_ENDPOINT}`);
  } else {
    log('⚠️  No se configuró Webshare.io. Se usará conexión directa (SIN PROXY).');
  }

  log('👋 Monitor citaconsular iniciado.');
  await cycleOnce();
  setInterval(cycleOnce, INTERVAL_MS);
})();
