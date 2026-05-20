# Control mensual de alquiler de cuartos

App web para registrar cuartos, inquilinos, alquiler mensual, pagos, saldos, reportes e incidencias.

## Como abrir

Opcion simple:

1. Abre `index.html` con doble clic.
2. Usa el selector de mes para revisar o registrar pagos por periodo.

Opcion con servidor local, si prefieres abrirla desde navegador en `localhost`:

```powershell
node server.cjs
```

Luego entra a:

```text
http://localhost:4173
```

## Como usar

1. Registra cada cuarto con su inquilino, monto mensual y dia de pago.
2. Cada vez que te paguen, agrega el pago en "Registrar pago".
3. El resumen muestra ingreso esperado, cobrado, saldo por cobrar y ocupacion.
4. Usa "Exportar CSV" para sacar el resumen del mes y abrirlo en Excel.

## Configurar Supabase

1. Crea un proyecto en https://supabase.com.
2. En Supabase, abre `SQL Editor`.
3. Copia y ejecuta el contenido de `supabase-schema.sql`.
4. Ve a `Authentication > Users` y crea tu primer usuario con correo y contrasena.
5. Vuelve al `SQL Editor` y convierte ese usuario en administrador:

```sql
update public.profiles
set role = 'admin', name = 'Administrador'
where email = 'TU_CORREO_AQUI';
```

6. Ve a `Project Settings > API`.
7. Copia `Project URL` y `anon public key`.
8. Pegalos en `supabase-config.js`:

```js
window.APP_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_ANON_KEY",
};
```

9. Recarga la app e inicia sesion con el correo y contrasena creados en Supabase.

## Reportes

La seccion "Reportes" muestra los principales indicadores del mes seleccionado:

- Eficiencia de cobro.
- Morosidad.
- Cuartos con deuda.
- Ticket promedio de alquiler.
- Incidencias por pagos vencidos, pagos parciales, pagos sin registrar y cuartos disponibles.
- Pagos recientes del mes.

## Seguridad y usuarios

Roles disponibles:

- Administrador: puede gestionar cuartos, pagos y usuarios.
- Operador: puede gestionar cuartos y pagos.
- Solo lectura: puede revisar la informacion y exportar reportes.

Los usuarios se crean en `Authentication > Users` dentro de Supabase. Luego, desde la seccion "Usuarios" de la app, un administrador puede cambiar nombre, rol y estado.

Los datos se guardan en Supabase, no en el navegador. Esto permite usar la app desde varios dispositivos con la misma informacion.
