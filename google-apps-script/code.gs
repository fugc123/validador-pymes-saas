/**
 * ============================================================================
 * VALIDADOR PYME SAAS — GOOGLE APPS SCRIPT MULTI-TENANT (v2.0)
 * ============================================================================
 * 
 * Ingestor automático de correos SIPAP bancarios para comercios minoristas.
 * Compatible con: Banco Itaú, GNB, UENO, Familiar, Atlas y Continental.
 * 
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Ingresá a https://script.google.com con la cuenta de Gmail donde llegan los avisos bancarios.
 * 2. Pegá este código completo en el editor.
 * 3. Reemplazá las constantes BASE_API_URL, MERCHANT_SLUG y WEBHOOK_SECRET con las de tu local.
 * 4. Hacé clic en "Ejecutar" una vez para autorizar los permisos de lectura de Gmail.
 * 5. Configurá un Activador (Trigger) temporizado para que se ejecute cada 1 minuto.
 */

// CONFIGURACIÓN POR COMERCIO (Obtenida desde el Panel de Dueño del Validador)
const BASE_API_URL = 'https://tu-dominio.com'; // O URL de Cloudflare Tunnel / Ngrok
const MERCHANT_SLUG = 'kiosko-san-roque';
const WEBHOOK_SECRET = 'sec_kiosko_san_roque_pilot_2026';

// ETIQUETA EN GMAIL PARA CORREOS YA REGISTRADOS
const LABEL_NAME = 'SIPAP_Validador';

function procesarTransferenciasBancarias() {
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  // Filtro de búsqueda que cubre los 6 bancos paraguayos y descarta los ya procesados
  const searchQuery = '("itau" OR "itaú" OR "gnb" OR "ueno" OR "familiar" OR "atlas" OR "continental" OR "sipap" OR "transferencia" OR "acreditada") -label:' + LABEL_NAME;
  Logger.log('🔍 Buscando avisos bancarios con filtro: ' + searchQuery);

  const threads = GmailApp.search(searchQuery, 0, 15);
  Logger.log('📬 Hilos no procesados encontrados: ' + threads.length);

  if (threads.length === 0) {
    return;
  }

  const webhookEndpoint = BASE_API_URL + '/api/v1/webhook/' + MERCHANT_SLUG;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();

    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const bodyText = msg.getPlainBody();
      const bodyHtml = msg.getBody();
      const subject = msg.getSubject();

      Logger.log('➡️ Procesando aviso: "' + subject + '" (ID: ' + msg.getId() + ')');

      try {
        const payload = JSON.stringify({
          text: bodyText,
          html: bodyHtml,
          subject: subject,
          date: msg.getDate().toISOString()
        });

        const options = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'X-Merchant-Webhook-Secret': WEBHOOK_SECRET
          },
          payload: payload,
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(webhookEndpoint, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        Logger.log('✅ Respuesta del servidor (HTTP ' + statusCode + '): ' + responseText);

        // Si el servidor lo creó (201) o ya existía (200), marcamos como procesado
        if (statusCode >= 200 && statusCode < 300) {
          thread.addLabel(label);
          thread.markRead();
          Logger.log('🏷️ Etiqueta ' + LABEL_NAME + ' agregada exitosamente.');
        } else {
          Logger.log('⚠️ Servidor rechazó el mensaje (HTTP ' + statusCode + '). No se marcará como procesado para reintento.');
        }
      } catch (err) {
        Logger.log('❌ Error enviando correo ' + msg.getId() + ': ' + err.toString());
      }
    }
  }
}
