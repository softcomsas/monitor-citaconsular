// debug-session.js
// Script que primero obtiene una sesión válida y luego hace la llamada

require('dotenv').config();
const request = require('request-promise');

const mainPageUrl = 'https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048';
const apiUrl = 'https://www.citaconsular.es/onlinebookings/main/';

const headers = {
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

function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

(async () => {
  // Usar jar de cookies para mantener la sesión
  const cookieJar = request.jar();
  
  try {
    console.log('🔸 Paso 1: Obteniendo sesión de la página principal...');
    
    // Primer GET para establecer sesión
    const mainPageResponse = await request.get({
      url: mainPageUrl,
      headers: headers,
      jar: cookieJar,
      timeout: 30000
    });
    
    console.log('✅ Página principal obtenida');
    console.log('📏 Longitud:', mainPageResponse.length);
    
    // Mostrar cookies obtenidas
    const cookies = cookieJar.getCookieString(mainPageUrl);
    console.log('🍪 Cookies obtenidas:', cookies);
    
    console.log('');
    console.log('🔸 Paso 2: Haciendo llamada a la API...');
    
    // Ahora hacer la llamada a la API con las cookies de la sesión
    const callback = generateCallback();
    const timestamp = Date.now();
    const srcParam = encodeURIComponent(`https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048`);
    
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
    
    console.log('🔗 URL API:', apiUrlFull);
    console.log('📞 Callback:', callback);
    
    const apiHeaders = {
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
    
    const apiResponse = await request.get({
      url: apiUrlFull,
      headers: apiHeaders,
      jar: cookieJar,
      timeout: 30000
    });
    
    console.log('✅ Respuesta API obtenida');
    console.log('📏 Longitud de respuesta:', apiResponse.length);
    console.log('');
    
    if (apiResponse.length > 0) {
      console.log('📝 Primeros 1000 caracteres de la respuesta:');
      console.log('---');
      console.log(apiResponse.substring(0, 1000));
      console.log('---');
      console.log('');
      
      // Verificar si contiene el callback
      if (apiResponse.includes(callback)) {
        console.log('✅ La respuesta SÍ contiene el callback');
        
        // Extraer contenido JSONP
        try {
          const jsonStart = apiResponse.indexOf('(') + 1;
          const jsonEnd = apiResponse.lastIndexOf(')');
          const jsonContent = apiResponse.substring(jsonStart, jsonEnd);
          const htmlContent = JSON.parse(jsonContent);
          
          console.log('✅ Contenido JSONP parseado exitosamente');
          console.log('📏 Longitud del HTML:', htmlContent.length);
          
          if (htmlContent.includes('No hay horas disponibles')) {
            console.log('✅ Encontrado "No hay horas disponibles" - NO HAY CITAS');
          } else {
            console.log('🚨 NO encontrado "No hay horas disponibles" - POSIBLE DISPONIBILIDAD');
          }
          
          if (htmlContent.includes('clsDivDatetimeSlot')) {
            console.log('🚨 Encontrados elementos de slots de tiempo - HAY CITAS DISPONIBLES');
          }
          
        } catch (parseError) {
          console.error('❌ Error parseando JSONP:', parseError.message);
        }
        
      } else {
        console.log('❌ La respuesta NO contiene el callback');
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