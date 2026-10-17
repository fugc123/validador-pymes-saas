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
 * 3. Reemplazá las constantes BASE_API_URL y MERCHANT_SLUG con las de tu local.
 * 4. Guardá el secreto del webhook como Propiedad del Script (NO en el código):
 *    en el editor, andá a Configuración del proyecto > Propiedades del script y
 *    agregá WEBHOOK_SECRET con el valor que copiaste desde el Panel de Dueño.
 * 5. Hacé clic en "Ejecutar" una vez para autorizar los permisos de lectura de Gmail.
 * 6. Configurá un Activador (Trigger) temporizado para que se ejecute cada 1 minuto.
 */

// CONFIGURACIÓN POR COMERCIO (Obtenida desde el Panel de Dueño del Validador)
const BASE_API_URL = 'https://tu-dominio.com'; // O URL de Cloudflare Tunnel / Ngrok
const MERCHANT_SLUG = 'kiosko-san-roque';

// ETIQUETA EN GMAIL PARA CORREOS YA REGISTRADOS (solo poda la búsqueda)
const LABEL_NAME = 'SIPAP_Validador';

// REGISTRO POR MENSAJE DE LOS AVISOS YA ENVIADOS.
// GmailMessage no expone getLabels() ni addLabel(): las etiquetas se alcanzan
// solo desde GmailThread y son por hilo, así que el dedupe exacto por mensaje
// vive en las Propiedades del Script.
const PROCESSED_KEY = 'PROCESSED_MSG_IDS';
// ponytail: FIFO de 200 IDs por el límite de 9 KB de cada Propiedad del Script;
// un ID expulsado solo provoca un reenvío y el webhook lo absorbe (200 already_exists).
const PROCESSED_CAP = 200;

/**
 * Lee el secreto del webhook desde las Propiedades del Script del proyecto.
 * El valor lo define el dueño desde su panel; nunca se escribe en el código.
 * Si la propiedad falta o está vacía, el script falla cerrado sin enviar nada.
 */
function obtenerSecretoWebhook_() {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || !secret.trim()) {
    throw new Error(
      'Falta la Propiedad del Script WEBHOOK_SECRET. Copiá el secreto desde el Panel de Dueño y guardalo en Configuración del proyecto > Propiedades del script.'
    );
  }
  return secret;
}

function procesarTransferenciasBancarias() {
  // Fail closed antes de leer el buzón: sin secreto configurado no se envía,
  // no se etiqueta y no se marca nada como procesado.
  const webhookSecret = obtenerSecretoWebhook_();

  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  // Filtro de búsqueda que cubre los 6 bancos paraguayos y descarta los hilos
  // donde todos los mensajes ya fueron registrados. El criterio fino es por
  // mensaje: el filtro -label solo reduce el alcance de la búsqueda.
  // "transferencias"/"recibida"/"has recibido"/"te transfirió" cubren
  // redacciones alternativas de avisos recibidos; Gmail no hace stemming.
  const searchQuery = '("itau" OR "itaú" OR "gnb" OR "ueno" OR "familiar" OR "atlas" OR "continental" OR "sipap" OR "transferencia" OR "transferencias" OR "recibida" OR "has recibido" OR "te transfirio" OR "te transfirió" OR "acreditada") -label:' + LABEL_NAME;
  Logger.log('🔍 Buscando avisos bancarios con filtro: ' + searchQuery);

  const threads = GmailApp.search(searchQuery, 0, 15);
  Logger.log('📬 Hilos no procesados encontrados: ' + threads.length);

  if (threads.length === 0) {
    return;
  }

  const webhookEndpoint = BASE_API_URL + '/api/v1/webhook/' + MERCHANT_SLUG;

  const scriptProperties = PropertiesService.getScriptProperties();
  let processedIds;
  try {
    processedIds = JSON.parse(scriptProperties.getProperty(PROCESSED_KEY) || '[]');
  } catch (errParse) {
    // Store ilegible: se reenvía todo lo que devuelva la búsqueda; el
    // webhook responde already_exists (200) y no duplica registros.
    processedIds = [];
  }
  let registryChanged = false;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    let threadComplete = true;

    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];

      // Un mensaje ya registrado no se reenvía. Uno fallido o recibido después
      // en el mismo hilo sigue elegible: su ID no está en el registro.
      if (processedIds.indexOf(msg.getId()) !== -1) {
        continue;
      }

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
            'X-Merchant-Webhook-Secret': webhookSecret
          },
          payload: payload,
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(webhookEndpoint, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        Logger.log('✅ Respuesta del servidor (HTTP ' + statusCode + '): ' + responseText);

        // Si el servidor lo creó (201) o ya existía (200), el mensaje pasa al
        // registro; un fallo deja el hilo completo pendiente de etiquetar.
        if (statusCode >= 200 && statusCode < 300) {
          processedIds.push(msg.getId());
          registryChanged = true;
          msg.markRead();
          Logger.log('✅ Mensaje ' + msg.getId() + ' registrado.');
        } else {
          threadComplete = false;
          Logger.log('⚠️ Servidor rechazó el mensaje (HTTP ' + statusCode + '). No se marcará como procesado para reintento.');
        }
      } catch (err) {
        threadComplete = false;
        Logger.log('❌ Error enviando correo ' + msg.getId() + ': ' + err.toString());
      }
    }

    // La etiqueta declara el hilo terminado y acota la búsqueda (-label:):
    // solo se aplica cuando ningún mensaje quedó pendiente, así un fallo
    // parcial deja el hilo elegible para el próximo intento.
    if (threadComplete) {
      thread.addLabel(label);
    }
  }

  if (registryChanged) {
    if (processedIds.length > PROCESSED_CAP) {
      processedIds = processedIds.slice(-PROCESSED_CAP);
    }
    scriptProperties.setProperty(PROCESSED_KEY, JSON.stringify(processedIds));
  }
}
