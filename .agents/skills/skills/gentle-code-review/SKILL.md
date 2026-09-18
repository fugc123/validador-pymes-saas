---
name: gentle-code-review
description: Habilidad de revisión de código basada en Gentleman Guardian Angel (GGA) para auditar diffs, detectar sobre-ingeniería, asegurar la política 0 bugs y verificar buenas prácticas.
---

# 🛡️ Gentle-AI™ Code Review & GGA Audit

Esta habilidad audita los cambios realizados en el proyecto bajo la filosofía **GGA (Gentleman Guardian Angel)**:

---

## 🔍 Checklist de Auditoría GGA

1. **YAGNI & Sobre-Ingeniería (Ponytail Audit)**:
   - ¿Se agregaron librerías innecesarias cuando la librería estándar o el código existente lo resolvía?
   - ¿Hay código muerto, archivos huérfanos o capas de abstracción no requeridas?

2. **Tipado & Robustez Estricta (0 Bugs)**:
   - ¿Existe algún uso implícito o explícito de `any`?
   - ¿Se silenciaron excepciones en bloques catch vacíos?
   - ¿Se mantuvieron los docstrings y comentarios útiles?

3. **Seguridad & Sanitización**:
   - ¿Se hardcodearon claves de API, tokens o contraseñas?
   - ¿Los endpoints tienen guardias de autenticación y validadores DTO?

4. **Verificación Runtime**:
   - ¿Se ejecutaron las pruebas unitarias y el comando de build con resultado de salida 0?
