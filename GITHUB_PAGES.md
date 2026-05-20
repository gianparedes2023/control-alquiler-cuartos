# Publicar en GitHub Pages

## 1. Crear repositorio

1. Entra a https://github.com/new
2. Nombre recomendado: `control-alquiler-cuartos`
3. Visibilidad: `Private` o `Public`
4. Marca `Add a README file`
5. Crea el repositorio.

## 2. Subir archivos

Sube la carpeta `docs` completa al repositorio.

La carpeta `docs` contiene los archivos que GitHub Pages debe publicar:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `.nojekyll`

## 3. Activar GitHub Pages

1. En el repositorio, entra a `Settings`.
2. Entra a `Pages`.
3. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
4. Guarda.

GitHub generara una URL parecida a:

```text
https://gianparedes2023.github.io/control-alquiler-cuartos/
```

## 4. Configurar Supabase para la URL publicada

En Supabase:

1. Ve a `Authentication > URL Configuration`.
2. En `Site URL`, pega la URL de GitHub Pages.
3. En `Redirect URLs`, agrega tambien la misma URL.

Esto es importante para confirmaciones de correo o recuperacion de contrasena.
