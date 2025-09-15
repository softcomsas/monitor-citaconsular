// analyze-content-safe.js
// Script que analiza con parsing más seguro

require('dotenv').config();
const request = require('request-promise');

const mainPageUrl = 'https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048';
const apiUrl = 'https://www.citaconsular.es/onlinebookings/main/';

function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

function safeParseJSONP(response, callback) {
  try {
    // Verificar que empiece con el callback
    if (!response.startsWith(callback + '=') && !response.startsWith(callback + '(')) {
      throw new Error('No comienza con callback');
    }
    
    // Encontrar el inicio del contenido JSON
    let jsonStart = response.indexOf('(');
    if (jsonStart === -1) {
      jsonStart = response.indexOf('=');
    }
    jsonStart += 1;
    
    // Encontrar el final, buscando el último paréntesis de cierre
    let jsonEnd = response.lastIndexOf(')');
    if (jsonEnd === -1) {
      jsonEnd = response.length;
    }
    
    const jsonContent = response.substring(jsonStart, jsonEnd);
    
    console.log('🔍 Contenido JSON extraído (primeros 500 chars):');
    console.log('---');
    console.log(jsonContent.substring(0, 500));
    console.log('---');
    console.log('');
    
    // Intentar parsear
    const htmlContent = JSON.parse(jsonContent);
    return htmlContent;
    
  } catch (error) {
    console.error('❌ Error parsing JSONP:', error.message);
    console.log('📝 Respuesta cruda (primeros 1000 chars):');
    console.log('---');
    console.log(response.substring(0, 1000));
    console.log('---');
    
    // Si falla el parsing, trabajar directamente con la respuesta cruda
    return response;
  }
}

(async () => {
  const cookieJar = request.jar();
  
  try {
    console.log('🔸 Estableciendo sesión...');
    await request.get({
      url: mainPageUrl,
      jar: cookieJar,
      timeout: 30000
    });
    
    console.log('🔸 Haciendo llamada API...');
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
    
    console.log('✅ Respuesta obtenida, longitud:', apiResponse.length);
    console.log('📞 Callback usado:', callback);
    console.log('');
    
    // Parsing seguro
    const htmlContent = safeParseJSONP(apiResponse, callback);
    
    console.log('📊 Analizando contenido...');
    console.log('📏 Longitud del contenido:', typeof htmlContent === 'string' ? htmlContent.length : 'No es string');
    console.log('');
    
    // Analizar directamente en la respuesta (sea parseada o no)
    const contentToAnalyze = typeof htmlContent === 'string' ? htmlContent : apiResponse;
    
    // Buscar "No hay horas disponibles"
    const hasNoHorasText = contentToAnalyze.includes('No hay horas disponibles');
    console.log('🔍 "No hay horas disponibles":', hasNoHorasText ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
    
    if (hasNoHorasText) {
      const index = contentToAnalyze.indexOf('No hay horas disponibles');
      console.log('📍 Posición:', index);
      console.log('📝 Contexto:');
      console.log('---');
      console.log(contentToAnalyze.substring(Math.max(0, index - 200), index + 200));
      console.log('---');
    }
    
    // Buscar elementos de citas/slots
    const hasSlotElements = contentToAnalyze.includes('clsDivDatetimeSlot') || 
                           contentToAnalyze.includes('selecttime') ||
                           contentToAnalyze.includes('disponible');
    
    console.log('🎯 Elementos de slots:', hasSlotElements ? '✅ ENCONTRADOS' : '❌ NO ENCONTRADOS');
    
    // Buscar texto específico de disponibilidad
    const hasAvailableText = contentToAnalyze.includes('Hueco libre') ||
                            contentToAnalyze.includes('Huecos libres') ||
                            contentToAnalyze.includes('available');
    
    console.log('🟢 Texto de disponibilidad:', hasAvailableText ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
    
    console.log('');
    console.log('🎯 CONCLUSIÓN FINAL:');
    if (hasNoHorasText) {
      console.log('❌ NO HAY CITAS DISPONIBLES');
      console.log('   Razón: Se encontró el mensaje "No hay horas disponibles"');
    } else if (hasAvailableText) {
      console.log('✅ POSIBLE DISPONIBILIDAD DE CITAS');
      console.log('   Razón: Se encontraron textos de disponibilidad sin mensaje de no disponibilidad');
    } else {
      console.log('⚠️  ESTADO INCIERTO');
      console.log('   Razón: No se encontraron indicadores claros');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
})();