// monitor-citaconsular-v2-fixed.js
// ------------------------------------------------------------
// Monitor para citaconsular.es con nueva API JSONP
// - Usa la llamada directa para obtener información de disponibilidad
// - Detecta "No hay horas disponibles." para saber si hay citas
// - Soporte para proxies de Webshare.io con fallback sin proxy
// - Alertas por Telegram y webhook
// ------------------------------------------------------------

require('dotenv').config();

const request = require('request-promise');

// ===== Config =====
const API_URL = process.env.API_URL || 'https://www.citaconsular.es/onlinebookings/main/';
const SERVICE_ID = process.env.SERVICE_ID || 'bkt873048';
const PUBLIC_KEY = process.env.PUBLIC_KEY || '28db94e270580be60f6e00285a7d8141f';

const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '60000', 10); // 1 min por defecto

// Webhook opcional para alertas
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';

// ===== Telegram Configuration =====
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Convertir CHAT_IDs en array (soporte para múltiples usuarios)
const TELEGRAM_CHAT_IDS = TELEGRAM_CHAT_ID ? TELEGRAM_CHAT_ID.split(',').map(id => id.trim()) : [];

// ===== Webshare.io Configuration =====
const WEBSHARE_USERNAME = process.env.WEBSHARE_USERNAME || '';
const WEBSHARE_PASSWORD = process.env.WEBSHARE_PASSWORD || '';
const PROXY_LIST_FILE = process.env.PROXY_LIST_FILE || 'Webshare 100 proxies.txt';

// ===== Estado =====
let callCount = 0;
let currentProxyIndex = 0;
let proxyList = [];
let blacklistedProxies = new Set();
let currentSessionId = Math.random().toString(36).substring(7);
const MAX_CALLS_PER_PROXY = 3;
const BLACKLIST_DURATION = 10 * 60 * 1000; // 10 minutos

// ===== Helpers =====
const fs = require('fs');
const path = require('path');

function log(msg, ...rest) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`, ...rest);
}

// Cargar lista de proxies desde archivo
function loadProxyList() {
  try {
    const filePath = path.join(__dirname, PROXY_LIST_FILE);
    if (!fs.existsSync(filePath)) {
      log(`⚠️  Archivo de proxies no encontrado: ${filePath}`);
      return [];
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    const proxies = lines.map(line => {
      const parts = line.trim().split(':');
      if (parts.length === 4) {
        return {
          host: parts[0],
          port: parts[1],
          username: parts[2],
          password: parts[3],
          url: `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`,
          failures: 0,
          lastUsed: 0
        };
      }
      return null;
    }).filter(proxy => proxy !== null);
    
    log(`✅ Cargados ${proxies.length} proxies desde ${PROXY_LIST_FILE}`);
    return proxies;
  } catch (error) {
    log(`❌ Error cargando lista de proxies: ${error.message}`);
    return [];
  }
}

// Obtener el siguiente proxy disponible
function getNextProxy() {
  if (proxyList.length === 0) {
    return null;
  }
  
  // Limpiar blacklist antigua (proxies bloqueados hace más de 10 minutos)
  const now = Date.now();
  for (const [proxyUrl, blacklistTime] of blacklistedProxies.entries()) {
    if (now - blacklistTime > BLACKLIST_DURATION) {
      blacklistedProxies.delete(proxyUrl);
      log(`🔓 Proxy desbloqueado: ${proxyUrl.split('@')[1]}`);
    }
  }
  
  // Buscar proxy disponible empezando desde el índice actual
  let attempts = 0;
  while (attempts < proxyList.length) {
    const proxy = proxyList[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    
    // Verificar si el proxy no está en blacklist
    if (!blacklistedProxies.has(proxy.url)) {
      proxy.lastUsed = now;
      return proxy;
    }
    
    attempts++;
  }
  
  log(`⚠️  Todos los proxies están bloqueados temporalmente`);
  return null;
}

// Marcar proxy como bloqueado
function blacklistProxy(proxy, reason = '') {
  if (!proxy) return;
  
  proxy.failures++;
  blacklistedProxies.set(proxy.url, Date.now());
  
  const proxyDisplay = `${proxy.host}:${proxy.port}`;
  log(`🚫 Proxy bloqueado: ${proxyDisplay} (fallos: ${proxy.failures}) - ${reason}`);
}

function buildWebshareProxyUrl() {
  const proxy = getNextProxy();
  if (!proxy) {
    return null;
  }
  
  return {
    url: proxy.url,
    proxy: proxy
  };
}

function forceIPRotation() {
  currentSessionId = Math.random().toString(36).substring(7);
  log(`🔄 Rotación de sesión - Nueva sesión: ${currentSessionId}`);
}

function currentProxyString() {
  const totalProxies = proxyList.length;
  const blacklistedCount = blacklistedProxies.size;
  const availableCount = totalProxies - blacklistedCount;
  
  if (totalProxies === 0) {
    return 'SIN PROXY';
  }
  
  return `Proxies: ${availableCount}/${totalProxies} disponibles`;
}

function buildHttpClient(useProxy = true) {
  const options = {
    timeout: 30000,
    followRedirect: true,
  };

  // Configurar proxy solo si se solicita y está disponible
  if (useProxy && proxyList.length > 0) {
    const proxyConfig = buildWebshareProxyUrl();
    if (proxyConfig && proxyConfig.url) {
      options.proxy = proxyConfig.url;
      options._proxyObject = proxyConfig.proxy; // Guardar referencia para manejo de errores
    }
  }

  return options;
}

// Genera un callback único para la llamada JSONP
function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

// Construye la URL con todos los parámetros necesarios
function buildAPIUrl() {
  const callback = generateCallback();
  const timestamp = Date.now();
  const srcParam = encodeURIComponent(`https://www.citaconsular.es/es/hosteds/widgetdefault/${PUBLIC_KEY}/${SERVICE_ID}`);
  
  const params = new URLSearchParams({
    'callback': callback,
    'type': 'default',
    'publickey': PUBLIC_KEY,
    'lang': 'es',
    'services[]': SERVICE_ID,
    'version': '5',
    'src': srcParam,
    '_': timestamp.toString()
  });
  
  return {
    url: `${API_URL}?${params.toString()}`,
    callback
  };
}

// Analiza la respuesta JSONP para determinar disponibilidad
function analyzeResponse(responseBody, callback) {
  try {
    // Verificar que hay contenido
    if (!responseBody || responseBody.length === 0) {
      return {
        hasContent: false,
        noAvailable: false,
        hasSlots: false,
        contentLength: 0,
        rawContent: '',
        error: 'Respuesta vacía'
      };
    }
    
    // La respuesta debería comenzar con el callback
    const expectedStart = callback + '(';
    if (!responseBody.startsWith(expectedStart)) {
      // Si no es formato JSONP válido, analizamos la respuesta cruda
      log(`⚠️  Respuesta no es JSONP válido, analizando respuesta cruda`);
      
      // *** SIMULACIÓN: Forzar que parezca que hay citas disponibles ***
      log(`🎭 SIMULACIÓN: Fingiendo que NO hay mensaje de "No hay horas disponibles"`);
      
      const hasNoAvailable = false; // SIMULACIÓN: fingir que NO encontramos el mensaje
      const hasSlots = true;        // SIMULACIÓN: fingir que SÍ encontramos slots
      
      return {
        hasContent: true,
        noAvailable: hasNoAvailable,
        hasSlots: hasSlots,
        contentLength: responseBody.length,
        rawContent: 'SIMULACIÓN: Contenido fingido con citas disponibles...',
        error: 'Formato JSONP no válido (SIMULACIÓN ACTIVA)'
      };
    }
    
    // Extraer el contenido entre paréntesis
    const jsonStart = responseBody.indexOf('(') + 1;
    const jsonEnd = responseBody.lastIndexOf(')');
    const jsonContent = responseBody.substring(jsonStart, jsonEnd);
    
    // El contenido es una cadena JSON que contiene HTML
    const htmlContent = JSON.parse(jsonContent);
    
    // Buscar el texto que indica no disponibilidad
    const noAvailableText = 'No hay horas disponibles.';
    const hasNoAvailableText = htmlContent.includes(noAvailableText);
    
    // Si está vacío, también podría indicar problema
    const isEmpty = htmlContent.trim().length === 0;
    
    // Buscar otros indicadores de disponibilidad
    const hasAvailableSlots = htmlContent.includes('clsDivDatetimeSlot') || 
                             htmlContent.includes('selecttime') ||
                             htmlContent.includes('Hueco libre') ||
                             htmlContent.includes('Huecos libres');
    
    return {
      hasContent: !isEmpty,
      noAvailable: hasNoAvailableText,
      hasSlots: hasAvailableSlots,
      contentLength: htmlContent.length,
      rawContent: htmlContent.substring(0, 500) + (htmlContent.length > 500 ? '...' : '')
    };
    
  } catch (error) {
    log(`❌ Error analizando respuesta: ${error.message}`);
    
    // En caso de error, intentamos análisis básico de la respuesta cruda
    const hasNoAvailable = responseBody.includes('No hay horas disponibles');
    const hasSlots = responseBody.includes('clsDivDatetimeSlot') || 
                     responseBody.includes('selecttime') ||
                     responseBody.includes('Hueco libre');
    
    return {
      hasContent: responseBody.length > 0,
      noAvailable: hasNoAvailable,
      hasSlots: hasSlots,
      contentLength: responseBody.length,
      rawContent: responseBody.substring(0, 500) + (responseBody.length > 500 ? '...' : ''),
      error: `Error parsing: ${error.message}`
    };
  }
}

// Detecta si el error requiere cambio de IP
function isBlockingError(error) {
  const message = error.message.toLowerCase();
  const blockingPatterns = [
    'response code 403',
    'response code 429',
    'response code 502',
    'response code 503',
    'too many requests',
    'rate limit',
    'blocked',
    'captcha',
    'respuesta vacía'
  ];
  
  return blockingPatterns.some(pattern => message.includes(pattern));
}

async function sendAlert(payload) {
  log('🚨 ALERTA → Posibles citas disponibles!', payload);
  
  // Enviar por Telegram si está configurado
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
    await sendTelegramAlert(payload);
  }
  
  // Enviar por webhook si está configurado
  if (ALERT_WEBHOOK_URL) {
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
}

async function sendTelegramAlert(payload) {
  const { analysis, when, method } = payload;
  
  let status = '❓ ESTADO DESCONOCIDO';
  if (analysis.noAvailable) {
    status = '❌ No hay citas disponibles';
  } else if (analysis.hasSlots) {
    status = '✅ ¡POSIBLES CITAS ENCONTRADAS!';
  } else if (!analysis.hasContent) {
    status = '⚠️  Respuesta vacía - verificar';
  }
  
  const message = `🚨 *MONITOR CITACONSULAR V2* 🚨
    
${status}

📊 *Análisis:*
• Contenido: ${analysis.hasContent ? 'Sí' : 'No'} (${analysis.contentLength} chars)
• Sin disponibilidad: ${analysis.noAvailable ? 'Sí' : 'No'}
• Slots detectados: ${analysis.hasSlots ? 'Sí' : 'No'}
• Método: ${method || 'Desconocido'}
⏰ *Detectado:* ${new Date(when).toLocaleString('es-ES')}

🔗 *Enlace:* [Ir a CitaConsular](https://www.citaconsular.es/es/hosteds/widgetdefault/${PUBLIC_KEY}/${SERVICE_ID})

${analysis.hasSlots && !analysis.noAvailable ? '⚡ *¡ACTÚA RÁPIDO!* Las citas pueden desaparecer en cualquier momento.' : ''}`;

  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  // Enviar mensaje a cada Chat ID
  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      await request.post({
        url: telegramUrl,
        json: {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        },
        timeout: 10000,
      });
      
      log(`✅ Mensaje de alerta enviado por Telegram a usuario: ${chatId}`);
      
    } catch (error) {
      log(`⚠️  Error enviando alerta por Telegram a usuario ${chatId}:`, error.message);
    }
  }
}

async function sendTelegramStartMessage() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) return;
  
  const proxyStatus = proxyList.length > 0 ? 
    `🌐 *Proxies:* ${proxyList.length} proxies dinámicos cargados` : 
    '⚠️ *Proxies:* Sin proxies - conexión directa';
  
  const message = `🤖 *MONITOR CITACONSULAR V2 DINÁMICO* 🤖

🚀 Nueva versión con rotación dinámica de proxies
⏰ *Intervalo:* ${INTERVAL_MS / 1000} segundos
${proxyStatus}
📅 *Iniciado:* ${new Date().toLocaleString('es-ES')}

🔍 *Monitoreando servicio:* ${SERVICE_ID}
🔑 *Clave pública:* ${PUBLIC_KEY}

✅ Te notificaré inmediatamente si encuentro cambios en la disponibilidad.
🔄 Rotación automática entre múltiples proxies con blacklist inteligente.`;

  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  // Enviar mensaje de inicio a cada Chat ID
  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      await request.post({
        url: telegramUrl,
        json: {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        },
        timeout: 10000,
      });
      
      log(`✅ Mensaje de inicio enviado por Telegram a usuario: ${chatId}`);
      
    } catch (error) {
      log(`⚠️  Error enviando mensaje de inicio por Telegram a usuario ${chatId}:`, error.message);
    }
  }
}

// Realiza una petición completa (sesión + API)
async function performRequest(useProxy) {
  const requestOptions = buildHttpClient(useProxy);
  const currentProxy = requestOptions._proxyObject;
  const proxyDisplay = currentProxy ? `${currentProxy.host}:${currentProxy.port}` : 'directo';
  const method = useProxy ? `CON PROXY (${proxyDisplay})` : 'SIN PROXY';
  
  try {
    // Paso 1: Establecer sesión visitando la página principal
    const mainPageUrl = `https://www.citaconsular.es/es/hosteds/widgetdefault/${PUBLIC_KEY}/${SERVICE_ID}`;
    
    const browserHeaders = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'es-ES,es;q=0.9',
      'cache-control': 'max-age=0',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'referer': 'https://www.exteriores.gob.es/'
    };
    
    // Usar cookie jar para mantener sesión
    const sessionJar = request.jar();
    
    log(`🔐 [${method}] Estableciendo sesión en: ${mainPageUrl}`);
    const mainPageResponse = await request.get({
      url: mainPageUrl,
      headers: browserHeaders,
      jar: sessionJar,
      ...requestOptions
    });
    
    log(`✅ [${method}] Sesión establecida: ${mainPageResponse.length} chars`);
    
    // Verificar que realmente obtuvimos contenido de la página principal
    if (mainPageResponse.length === 0) {
      throw new Error(`Página principal devolvió respuesta vacía`);
    }
    
    // Pequeña pausa para simular comportamiento humano
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Paso 2: Hacer llamada JSONP con la sesión establecida
    const { url, callback } = buildAPIUrl();
    
    log(`🔗 [${method}] Llamando API: ${url.substring(0, 100)}...`);
    
    const jsonpHeaders = {
      'accept': '*/*',
      'accept-language': 'es-ES,es;q=0.9',
      'referer': 'https://www.citaconsular.es/',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'script',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    };
    
    // Realizar petición JSONP con la sesión
    const response = await request.get({
      url: url,
      headers: jsonpHeaders,
      jar: sessionJar,
      ...requestOptions
    });
    
    log(`📊 [${method}] Respuesta API: ${response.length} chars`);
    
    // Verificar que obtuvimos una respuesta no vacía
    if (response.length === 0) {
      throw new Error(`API devolvió respuesta vacía`);
    }
    
    // Analizar respuesta
    const analysis = analyzeResponse(response, callback);
    analysis.method = method;
    
    return analysis;
    
  } catch (error) {
    // Si usamos proxy y hay error, marcarlo como bloqueado
    if (useProxy && currentProxy) {
      blacklistProxy(currentProxy, error.message);
    }
    throw error;
  }
}

// ===== Ciclo principal =====
async function cycleOnce() {
  callCount += 1;
  
  log(`🚀 Ciclo #${callCount} iniciando...`);

  // Intentar primero con proxy (si hay proxies disponibles), luego sin proxy como fallback
  const hasProxies = proxyList.length > 0;
  const attempts = hasProxies ? [true, false] : [false];
  let lastError = null;
  
  for (const useProxyThisAttempt of attempts) {
    try {
      const analysis = await performRequest(useProxyThisAttempt);
      
      log(`📋 [${analysis.method}] Análisis: contenido=${analysis.hasContent}, sinDisponibilidad=${analysis.noAvailable}, tieneSlots=${analysis.hasSlots}, chars=${analysis.contentLength}`);
      
      // Determinar si enviar alerta (solo para contenido válido)
      let shouldAlert = false;
      let alertReason = '';
      
      if (analysis.hasContent && !analysis.noAvailable) {
        // Si no dice "No hay horas disponibles" y tiene contenido válido
        shouldAlert = true;
        alertReason = 'No se encontró el mensaje de "No hay horas disponibles"';
      }
      
      if (analysis.hasSlots && analysis.hasContent && !analysis.noAvailable) {
        // Si detectamos elementos de slots sin mensaje de no disponibilidad
        shouldAlert = true;
        alertReason = 'Se detectaron elementos de slots de tiempo sin mensaje de no disponibilidad';
      }
      
      if (shouldAlert) {
        await sendAlert({
          analysis,
          reason: alertReason,
          when: new Date().toISOString(),
          method: analysis.method,
          cycleNumber: callCount
        });
      } else {
        if (analysis.hasContent && analysis.noAvailable) {
          log(`✅ [${analysis.method}] Sin citas: Se confirmó "No hay horas disponibles"`);
        } else {
          log(`⚠️ [${analysis.method}] Estado incierto - respuesta sin contenido claro`);
        }
      }
      
      // Si llegamos aquí, el intento fue exitoso
      log(`✅ Ciclo #${callCount} completado exitosamente con ${analysis.method}`);
      return;
      
    } catch (err) {
      lastError = err;
      const methodName = useProxyThisAttempt ? 'CON PROXY' : 'SIN PROXY';
      log(`💥 Error ${methodName}: ${err.message}`);
      
      // Si es el último intento, procesar el error
      if (useProxyThisAttempt === attempts[attempts.length - 1]) {
        break;
      }
      
      // Si no es el último intento, continuar con el siguiente
      log(`🔄 Probando siguiente método...`);
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  if (lastError) {
    log(`💥 Error en todos los intentos del ciclo #${callCount}: ${lastError.message}`);
  }
}

// ===== Arranque =====
(async () => {
  if (!PUBLIC_KEY || !SERVICE_ID) {
    console.error('Faltan PUBLIC_KEY o SERVICE_ID en .env o en el código');
    process.exit(1);
  }

  // Cargar lista de proxies
  proxyList = loadProxyList();

  if (proxyList.length > 0) {
    log(`🌐 Sistema de proxies dinámico activado: ${proxyList.length} proxies cargados (con fallback sin proxy)`);
  } else {
    log('⚠️  No se pudieron cargar proxies. Se usará conexión directa (SIN PROXY).');
  }

  // Verificar configuración de Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
    log(`📱 Telegram configurado - Se enviarán alertas a ${TELEGRAM_CHAT_IDS.length} usuario(s): ${TELEGRAM_CHAT_IDS.join(', ')}`);
  } else {
    log('⚠️  Telegram no configurado - No se enviarán alertas por Telegram');
  }

  log('👋 Monitor citaconsular V2 (SIMULACIÓN DE ALERTAS) iniciado.');
  log(`🎭 MODO SIMULACIÓN: Este ciclo fingirá encontrar citas disponibles`);
  log(`🔍 Monitoreando servicio: ${SERVICE_ID}`);
  log(`🔑 Clave pública: ${PUBLIC_KEY}`);
  
  // Enviar mensaje de inicio por Telegram (no bloquear si falla)
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
    sendTelegramStartMessage().catch(() => {
      log('⚠️  No se pudo enviar mensaje de inicio por Telegram, pero el monitor continuará');
    });
  }
  
  await cycleOnce();
  setInterval(cycleOnce, INTERVAL_MS);
})();