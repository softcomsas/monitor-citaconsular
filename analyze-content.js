// analyze-content.js
// Script que analiza específicamente el contenido HTML devuelto

require('dotenv').config();
const request = require('request-promise');

const mainPageUrl = 'https://www.citaconsular.es/es/hosteds/widgetdefault/28db94e270580be60f6e00285a7d8141f/bkt873048';
const apiUrl = 'https://www.citaconsular.es/onlinebookings/main/';

function generateCallback() {
  return `jQuery${Math.floor(Math.random() * 1000000000000000000)}_${Date.now()}`;
}

(async () => {
  const cookieJar = request.jar();
  
  try {
    // Establecer sesión
    await request.get({
      url: mainPageUrl,
      jar: cookieJar,
      timeout: 30000
    });
    
    // Hacer llamada API
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
    
    // Extraer y analizar contenido
    const jsonStart = apiResponse.indexOf('(') + 1;
    const jsonEnd = apiResponse.lastIndexOf(')');
    const jsonContent = apiResponse.substring(jsonStart, jsonEnd);
    const htmlContent = JSON.parse(jsonContent);
    
    console.log('📊 Análisis del contenido HTML:');
    console.log('📏 Longitud total:', htmlContent.length);
    console.log('');
    
    // Buscar "No hay horas disponibles"
    const noHorasIndex = htmlContent.indexOf('No hay horas disponibles');
    if (noHorasIndex !== -1) {
      console.log('🔍 Encontrado "No hay horas disponibles" en posición:', noHorasIndex);
      console.log('📝 Contexto (300 caracteres antes y después):');
      const start = Math.max(0, noHorasIndex - 300);
      const end = Math.min(htmlContent.length, noHorasIndex + 300);
      console.log('---');
      console.log(htmlContent.substring(start, end));
      console.log('---');
      console.log('');
    }
    
    // Contar todas las apariciones
    const regex = /No hay horas disponibles/g;
    const matches = htmlContent.match(regex);
    console.log('📊 Número de apariciones de "No hay horas disponibles":', matches ? matches.length : 0);
    console.log('');
    
    // Buscar elementos de slots visibles (no ocultos)
    const visibleSlotRegex = /<div[^>]*clsDivDatetimeSlot[^>]*(?!.*display:\s*none)[^>]*>/g;
    const visibleSlots = htmlContent.match(visibleSlotRegex);
    console.log('🎯 Elementos de slots VISIBLES encontrados:', visibleSlots ? visibleSlots.length : 0);
    
    if (visibleSlots && visibleSlots.length > 0) {
      console.log('📝 Ejemplo de slot visible:');
      console.log(visibleSlots[0]);
    }
    
    // Buscar elementos ocultos
    const hiddenSlotRegex = /<div[^>]*clsDivDatetimeSlot[^>]*display:\s*none[^>]*>/g;
    const hiddenSlots = htmlContent.match(hiddenSlotRegex);
    console.log('👻 Elementos de slots OCULTOS encontrados:', hiddenSlots ? hiddenSlots.length : 0);
    
    // Buscar divs con contenido específico de no disponibilidad
    const noAvailableRegex = /<div[^>]*>[^<]*No hay horas disponibles[^<]*<\/div>/g;
    const noAvailableDivs = htmlContent.match(noAvailableRegex);
    console.log('📋 Divs con "No hay horas disponibles":', noAvailableDivs ? noAvailableDivs.length : 0);
    
    if (noAvailableDivs) {
      noAvailableDivs.forEach((div, index) => {
        console.log(`  ${index + 1}. ${div}`);
      });
    }
    
    console.log('');
    console.log('🎯 CONCLUSIÓN:');
    if (matches && matches.length > 0) {
      console.log('❌ NO HAY CITAS DISPONIBLES - Se encontró el mensaje de no disponibilidad');
    } else if (visibleSlots && visibleSlots.length > 0) {
      console.log('✅ POSIBLES CITAS DISPONIBLES - Se encontraron slots visibles sin mensaje de no disponibilidad');
    } else {
      console.log('⚠️  ESTADO INCIERTO - No se encontraron indicadores claros');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
})();