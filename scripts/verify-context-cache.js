const fs = require('fs');
const path = require('path');

const contextsDir = path.join(__dirname, '..', 'contexts');
const whitelist = new Set(['AuthContext.tsx', 'FilesContext.tsx']);

const contextFiles = fs
  .readdirSync(contextsDir)
  .filter(file => file.endsWith('.tsx'))
  .map(file => ({
    file,
    content: fs.readFileSync(path.join(contextsDir, file), 'utf8'),
  }));

const missingCache = contextFiles
  .filter(({ file, content }) => content.includes('BASE_URL') && !whitelist.has(file))
  .filter(({ content }) => !content.includes('useCachedState'))
  .map(({ file }) => file);

if (missingCache.length > 0) {
  console.error(
    'Contextos sin caché persistente detectados (llaman al backend pero no usan useCachedState):'
  );
  missingCache.forEach(file => console.error(` - ${file}`));
  process.exit(1);
}

console.log(
  'Verificación de caché completada: todos los contextos con llamadas remotas usan almacenamiento persistente o están explicitamente en la lista blanca.'
);
