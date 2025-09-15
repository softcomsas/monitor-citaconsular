// test-browser-like.js
// Script que simula más fielmente un navegador

require('dotenv').config();
const request = require('request-promise');

const mainPageUrl = 'https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048';
const apiUrl = 'https://www.citaconsular.es/onlinebookings/main/';

function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const cookieJar = request.jar();
  
  try {
    console.log('🔸 Paso 1: Visitando página principal...');
    
    // Headers más completos para simular navegador real
    const browserHeaders = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      'cache-control': 'max-age=0',
      'dnt': '1',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };
    
    const mainPageResponse = await request.get({
      url: mainPageUrl,
      headers: browserHeaders,
      jar: cookieJar,
      timeout: 30000,
      gzip: true
    });
    
    console.log('✅ Página principal obtenida');
    console.log('📏 Longitud:', mainPageResponse.length);
    
    // Mostrar cookies
    const cookies = cookieJar.getCookieString(mainPageUrl);
    console.log('🍪 Cookies:', cookies);
    
    // Esperar un momento como haría un navegador real
    console.log('⏳ Esperando 2 segundos...');
    await wait(2000);
    
    console.log('🔸 Paso 2: Haciendo llamada JSONP...');
    
    const callback = generateCallback();
    const timestamp = Date.now();
    const srcParam = encodeURIComponent(mainPageUrl);
    
    const params = new URLSearchParams({
      'callback': callback,
      'type': 'default',
      'publickey': '28db94e270580be60f6e00285a7d8141f',
      'lang': 'es',
      'services[]': 'bkt873048',
      'version': '5',
      'src': srcParam,
      '_': timestamp.toString()
    });
    
    const apiUrlFull = `${apiUrl}?${params.toString()}`;
    
    console.log('🔗 URL API completa:');
    console.log(apiUrlFull);
    console.log('');
    
    const jsonpHeaders = {
      'accept': '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      'dnt': '1',
      'referer': mainPageUrl,
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'script',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };
    
    const apiResponse = await request.get({
      url: apiUrlFull,
      headers: jsonpHeaders,
      jar: cookieJar,
      timeout: 30000,
      gzip: true
    });
    
    console.log('✅ Respuesta API obtenida');
    console.log('📏 Longitud:', apiResponse.length);
    console.log('📞 Callback:', callback);
    console.log('');
    
    if (apiResponse.length > 0) {
      console.log('📝 Inicio de la respuesta (500 chars):');
      console.log('---');
      console.log(apiResponse.substring(0, 500));
      console.log('---');
      console.log('');
      
      // Verificar formato JSONP
      if (apiResponse.includes(callback + '(')) {
        console.log('✅ Formato JSONP correcto detectado');
        
        try {
          // Extraer contenido
          const jsonStart = apiResponse.indexOf('(') + 1;
          const jsonEnd = apiResponse.lastIndexOf(')');
          const jsonContent = apiResponse.substring(jsonStart, jsonEnd);
          
          // Intentar parsear
          const htmlContent = JSON.parse(jsonContent);
          
          console.log('✅ Contenido parseado exitosamente');
          console.log('📏 Longitud HTML:', htmlContent.length);
          console.log('');
          
          // Análisis de disponibilidad
          const hasNoHoras = htmlContent.includes('No hay horas disponibles');
          const hasSlots = htmlContent.includes('clsDivDatetimeSlot');
          const hasAvailable = htmlContent.includes('Hueco libre') || htmlContent.includes('Huecos libres');
          
          console.log('🔍 Análisis de disponibilidad:');
          console.log('  "No hay horas disponibles":', hasNoHoras ? '✅ SÍ' : '❌ NO');
          console.log('  Elementos de slots:', hasSlots ? '✅ SÍ' : '❌ NO');
          console.log('  Texto de disponibilidad:', hasAvailable ? '✅ SÍ' : '❌ NO');
          console.log('');
          
          if (hasNoHoras) {
            console.log('❌ CONCLUSIÓN: NO HAY CITAS DISPONIBLES');
          } else if (hasAvailable) {
            console.log('✅ CONCLUSIÓN: POSIBLE DISPONIBILIDAD DE CITAS');
          } else if (hasSlots && !hasNoHoras) {
            console.log('⚠️  CONCLUSIÓN: ESTADO AMBIGUO - Hay elementos pero sin texto claro');
          } else {
            console.log('❓ CONCLUSIÓN: ESTADO DESCONOCIDO');
          }
          
        } catch (parseError) {
          console.error('❌ Error parseando JSON:', parseError.message);
        }
        
      } else {
        console.log('❌ Formato JSONP incorrecto');
        console.log('🔍 Buscando callback en respuesta...');
        if (apiResponse.includes(callback)) {
          console.log('✅ Callback encontrado en algún lugar de la respuesta');
        } else {
          console.log('❌ Callback NO encontrado en la respuesta');
        }
      }
    } else {
      console.log('❌ Respuesta vacía');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    if (error.statusCode) {
      console.error('📊 Status Code:', error.statusCode);
    }
  }
})();