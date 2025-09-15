// debug-curl-exact.js
// Script que replica exactamente el curl proporcionado

require('dotenv').config();
const request = require('request-promise');

// Usando exactamente los mismos valores del curl original
const originalUrl = 'https://www.citaconsular.es/onlinebookings/main/?callback=jQuery211023806588781222915_1757939491746&type=default&publickey=28db94e270580be60f6e00285a7d8141f&lang=es&services%5B%5D=bkt873048&version=5&src=https%3A%2F%2Fwww.citaconsular.es%2Fes%2Fhosteds%2Fwidgetdefault%2F28db94e270580be60f6e00285a7d8141f%2Fbkt873048&_=1757939491747';

const headers = {
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

const cookies = '_ga=GA1.1.2455770.1752167436; PHPSESSID=Kh%2CYn%2CIjNEmBb6Q29EnZmOLR; _ga_F3TYSDL945=GS2.1.s1757938035$o13$g1$t1757939439$j60$l0$h0';

(async () => {
  console.log('🔗 URL exacta del curl:', originalUrl);
  console.log('');
  
  try {
    const response = await request.get({
      url: originalUrl,
      headers: {
        ...headers,
        'Cookie': cookies
      },
      timeout: 30000
    });
    
    console.log('📊 Status: OK');
    console.log('📏 Longitud de respuesta:', response.length);
    console.log('');
    
    if (response.length > 0) {
      console.log('📝 Primeros 1000 caracteres de la respuesta:');
      console.log('---');
      console.log(response.substring(0, 1000));
      console.log('---');
      console.log('');
      
      if (response.length > 1000) {
        console.log('📝 Últimos 500 caracteres de la respuesta:');
        console.log('---');
        console.log(response.substring(Math.max(0, response.length - 500)));
        console.log('---');
      }
      
      // Buscar "No hay horas disponibles"
      if (response.includes('No hay horas disponibles')) {
        console.log('✅ Encontrado "No hay horas disponibles"');
      } else {
        console.log('❓ NO encontrado "No hay horas disponibles"');
      }
      
      // Buscar otros indicadores
      if (response.includes('clsDivDatetimeSlot')) {
        console.log('✅ Encontrados elementos de slots de tiempo');
      } else {
        console.log('❓ NO encontrados elementos de slots de tiempo');
      }
      
    } else {
      console.log('❌ Respuesta vacía');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    if (error.statusCode) {
      console.error('📊 Status Code:', error.statusCode);
    }
    if (error.response && error.response.body) {
      console.error('📝 Cuerpo de error:', error.response.body.substring(0, 500));
    }
  }
})();