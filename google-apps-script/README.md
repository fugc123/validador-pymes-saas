# ⚡ Google Apps Script — Ingestor de Transferencias Multi-Banco

Script de automatización para Gmail que conecta las notificaciones de transferencias de los bancos de Paraguay (**Itaú, GNB, UENO, Familiar, Atlas, Continental**) directamente con tu instancia del **Validador PYME SaaS**.

---

## 📋 Pasos de Instalación

1. **Abrir Google Apps Script**:
   - Ingresá a [script.google.com](https://script.google.com) con la cuenta de Gmail donde tu comercio recibe las notificaciones de cobro SIPAP.
   - Creá un "Nuevo Proyecto" y nombralo `Validador SIPAP Ingestor`.

2. **Copiar y Pegar**:
   - Borrá cualquier código existente en el archivo `Código.gs`.
   - Pegá el contenido de [`code.gs`](./code.gs).

3. **Configurar los datos de tu Comercio**:
   - Reemplazá:
     ```javascript
     const BASE_API_URL = 'https://tu-servidor.com'; // O tu túnel Cloudflare
     const MERCHANT_SLUG = 'kiosko-san-roque'; // Slug único de tu tienda
     const WEBHOOK_SECRET = 'sec_kiosko_san_roque_pilot_2026'; // Secret provisto en tu panel
     ```

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
