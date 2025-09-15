// debug-response.js
// Script para debuggear la respuesta de la API

require('dotenv').config();
const request = require('request-promise');

const API_URL = 'https://www.citaconsular.es/onlinebookings/main/';
const SERVICE_ID = 'bkt873048';
const PUBLIC_KEY = '28db94e270580be60f6e00285a7d8141f';

const BASE_HEADERS = {
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

const DEFAULT_COOKIES = '_ga=GA1.1.2455770.1752167436; PHPSESSID=Kh%2CYn%2CIjNEmBb6Q29EnZmOLR; _ga_F3TYSDL945=GS2.1.s1757938035$o13$g1$t1757939439$j60$l0$h0';

function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

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

(async () => {
  try {
    const { url, callback } = buildAPIUrl();
    
    console.log('🔗 URL:', url);
    console.log('📞 Callback esperado:', callback);
    console.log('');
    
    const response = await request.get({
      url: url,
      headers: {
        ...BASE_HEADERS,
        'Cookie': DEFAULT_COOKIES
      },
      timeout: 20000
    });
    
    console.log('📊 Status: OK');
    console.log('📏 Longitud de respuesta:', response.length);
    console.log('');
    console.log('📝 Primeros 500 caracteres de la respuesta:');
    console.log('---');
    console.log(response.substring(0, 500));
    console.log('---');
    console.log('');
    console.log('📝 Últimos 200 caracteres de la respuesta:');
    console.log('---');
    console.log(response.substring(Math.max(0, response.length - 200)));
    console.log('---');
    
    // Verificar si contiene el callback
    if (response.includes(callback)) {
      console.log('✅ La respuesta SÍ contiene el callback');
    } else {
      console.log('❌ La respuesta NO contiene el callback');
    }
    
    // Buscar "No hay horas disponibles"
    if (response.includes('No hay horas disponibles')) {
      console.log('✅ Encontrado "No hay horas disponibles"');
    } else {
      console.log('❓ NO encontrado "No hay horas disponibles"');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    if (error.statusCode) {
      console.error('📊 Status Code:', error.statusCode);
    }
  }
})();