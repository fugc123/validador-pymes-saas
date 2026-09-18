---
name: ecc-compliance
description: Hardening de infraestructura y auditoría de ciberseguridad complementaria para la Fase 4 del Universal 5-Phase Pipeline. Audita configuraciones de Docker Compose (puertos, privilegios rootless), supply-chain de pnpm audit, protección estricta de secretos en variables de entorno, y sanitización integral de APIs (OWASP Top 10, Helmet, CORS, Throttler).
metadata:
  origin: MoodsJournal-Security
---

# ECC Compliance Skill (Infrastructure Hardening & Cybersecurity)

Esta habilidad formaliza las verificaciones de seguridad defensiva, hardening de infraestructura y cumplimiento de normativas de privacidad clínica (HIPAA/GDPR) requeridas durante la **Fase 4: Auditoría, Ciberseguridad y Control de Defectos**.

---

## Cuándo Activar esta Habilidad

- Al crear o modificar manifiestos de Docker (`Dockerfile`, `docker-compose.yml`, `docker-compose.waha.yml`).
- Al agregar nuevas dependencias en `package.json` para auditar la cadena de suministro.
- Al exponer nuevos controladores HTTP, endpoints REST o webhooks externos.
- Al manipular claves criptográficas, certificados o variables de entorno.
- Antes de autorizar el pase a la Fase 5 (*Judgment Day*).

---

## Áreas de Auditoría y Verificación

### 1. Docker Compose & Hardening de Contenedores

#### A. Aislamiento de Puertos
- **Regla**: Los servicios internos como PostgreSQL o Redis **NUNCA** deben exponer sus puertos al host `0.0.0.0:5432` en producción. Solo deben ser accesibles dentro de la red interna de Docker (`networks`).
- **Verificación**: Comprobar que en `docker-compose.yml` los puertos de bases de datos solo se bindeen a `127.0.0.1` si se requiere depuración local:
  ```yaml
  # PASS: Seguro para desarrollo local
  ports:
    - "127.0.0.1:5432:5432"
  ```
- Para microservicios como WAHA (`docker-compose.waha.yml`), restringir el dashboard o asegurar con autenticación básica.

#### B. Privilegios de Contenedor (Rootless Execution)
- **Regla**: Los contenedores de Node.js no deben ejecutarse como `root`.
- **Verificación**: En el `Dockerfile`, declarar un usuario sin privilegios:
  ```dockerfile
  USER node
  ```

#### C. Volúmenes y Persistencia
- **Regla**: Las carpetas de datos (`pgdata`, `waha_sessions`) deben excluirse del repositorio git en `.gitignore` para evitar filtraciones de sesiones o volcados de datos.

---

### 2. Supply-Chain Security (`pnpm audit`)

#### Verificación de Dependencias
Ejecutar el escaneo estricto de vulnerabilidades de dependencias:
```bash
pnpm audit --audit-level=high
```
- **Criterio de Aceptación**: Cero vulnerabilidades de severidad `HIGH` o `CRITICAL`. Si existen advertencias moderadas en dependencias transitivas de desarrollo, deben justificarse o resolverse con `pnpm update`.

#### Verificación de AgentShield
Para validar la configuración de agentes y hooks de IA:
```bash
npx --yes ecc-agentshield scan --path .
```

---

### 3. Gestión de Secretos y Variables de Entorno

#### Checklist de Secretos
- [ ] No existen API keys (OpenAI, Gemini, Twilio, Meru), contraseñas de BD ni JWT secrets en el código fuente.
- [ ] El archivo `.env` está estrictamente ignorado en `.gitignore`.
- [ ] Existe un archivo `.env.example` actualizado con nombres de variables descriptivos y valores simulados/placeholder.
- [ ] La clave de cifrado simétrico `ENCRYPTION_KEY_AES256` tiene una longitud mínima de 32 bytes (64 caracteres hexadecimales) y se deriva adecuadamente con SHA-256 en runtime.

---

### 4. Sanitización y Protección de APIs (OWASP Top 10)

#### A. Cabeceras de Seguridad con Helmet
Verificar que la aplicación NestJS inicialice `helmet` para prevenir clickjacking, MIME sniffing y forzar políticas de seguridad:
```typescript
// src/main.ts
app.use(helmet());
```

#### B. Cross-Origin Resource Sharing (CORS) Restringido
- **FAIL**: `app.enableCors({ origin: '*' })` en entornos que manejan cookies de sesión médica.
- **PASS**:
  ```typescript
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  ```

#### C. Rate Limiting con NestJS Throttler
- Proteger rutas críticas de autenticación (`/auth/login`, `/auth/register`) y endpoints de LLM contra ataques de denegación de servicio (DoS) o consumo abusivo de saldo.

#### D. Validación Estricta de Cargas Útiles (ValidationPipe)
Garantizar que no se filtren propiedades inesperadas que puedan causar inyecciones o polución de prototipos:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Remueve propiedades que no estén en el DTO
    forbidNonWhitelisted: true, // Lanza error 400 si se envían campos extra
    transform: true,
  }),
);
```

---

## Procedimiento de Verificación Automatizada

Para certificar el cumplimiento de Fase 4 antes de comitear:

```bash
# 1. Verificación de compilación estricta
pnpm run build

# 2. Ejecución completa de suites de pruebas con cero fallos
pnpm test

# 3. Auditoría de seguridad de dependencias
pnpm audit --audit-level=high

# 4. Escaneo de configuración con AgentShield
pnpm run security:scan
```

Si cualquiera de estos cuatro pasos falla, **el build se rechaza de inmediato** y no se puede avanzar a la Fase 5.
