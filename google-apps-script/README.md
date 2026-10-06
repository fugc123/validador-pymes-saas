# ⚡ Google Apps Script — Ingestor de Transferencias Multi-Banco

Script de automatización para Gmail que conecta las notificaciones de transferencias de los bancos de Paraguay (**Itaú, GNB, UENO, Familiar, Atlas, Continental**) directamente con tu instancia del **Validador PYME SaaS**.

---

## 📋 Pasos de Instalación

1. **Abrir Google Apps Script**:
   - Ingresá a [script.google.com](https://script.google.com) con la cuenta de Gmail donde tu comercio recibe las notificaciones de cobro SIPAP.
   - Creá un "Nuevo Proyecto" y nombralo `Validador SIPAP Ingestor`.

2. **Copiar y Pegar**:
   - Borrá cualquier código existente en el archivo `Código.gs`.
   - Pegá el contenido de [`code.gs`](./code.gs). También podés pegar la copia personalizada desde el **Panel de Dueño** (botón *1. Copiar Mi Script Personalizado*), que ya trae la URL y el slug de tu comercio.

3. **Configurar el secreto del Comercio (copia separada)**:
   - El panel entrega **dos copias independientes**: el **script** (que nunca contiene secretos) y el **secreto** (botón *2. Copiar Secreto WEBHOOK_SECRET*). Ambas se pegan en lugares distintos.
   - El secreto del webhook **no se escribe en el código**. Guardalo como **Propiedad del Script**:
     - En el editor de Apps Script, abrí **Configuración del proyecto** (⚙️ Project Settings) → **Propiedades del script** (Script Properties).
     - Agregá una propiedad con nombre `WEBHOOK_SECRET` y el valor copiado desde el panel.
   - Si estás usando `code.gs` a mano, completá únicamente las constantes de tu comercio (el secreto no va aquí):
     ```javascript
     const BASE_API_URL = 'https://tu-servidor.com'; // O tu túnel Cloudflare
     const MERCHANT_SLUG = 'kiosko-san-roque'; // Slug único de tu tienda
     ```
   - Si la propiedad falta o está vacía, el script falla sin enviar nada: no llama al servidor, no etiqueta ni marca correos como leídos, y la ejecución aparece con error hasta que configures la propiedad.
   - Si el servidor responde con un estado distinto de 2xx (por ejemplo `401`), el script tampoco etiqueta ni marca el correo como leído: el mensaje queda pendiente para el próximo intento.

4. **Autorizar Permisos**:
   - Hacé clic en **Guardar** (Ctrl + S / Cmd + S).
   - En el menú superior, asegurate de seleccionar `procesarTransferenciasBancarias` y hacé clic en **Ejecutar**.
   - Google te solicitará autorizar los permisos de lectura de Gmail. Dale a *Avanzado* ➔ *Ir a Validador SIPAP (no seguro)* ➔ *Permitir*.

5. **Crear Activador Temporizado (Trigger de 1 Minuto)**:
   - En el menú izquierdo de Google Apps Script, hacé clic en el ícono de **Reloj** (Activadores / Triggers).
   - Hacé clic en **+ Añadir activador** (abajo a la derecha).
   - Configurá:
     - **Función que se ejecutará**: `procesarTransferenciasBancarias`
     - **Seleccionar fuente de eventos**: `Según el tiempo`
     - **Tipo de activador**: `Temporizador de minutos`
     - **Intervalo de minutos**: `Cada minuto`
   - Guardá los cambios.

¡Listo! A partir de ese momento, cada vez que un cliente pague por SIPAP desde cualquier banco, el aviso llegará al Gmail del local, el script lo enviará en segundos al servidor del Validador, y el cajero podrá confirmar el cobro en el POS sin tocar el celular.
