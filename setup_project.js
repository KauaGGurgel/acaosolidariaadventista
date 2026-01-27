/**
 * Script de Verificação e Setup do Projeto ASA
 * 
 * Este script serve como referência dos arquivos necessários.
 * Se você rodar `node setup_project.js`, ele confirmará se os arquivos críticos existem.
 */

import fs from 'fs';
import path from 'path';

const filesToCheck = [
  'index.html',
  'vite.config.ts',
  'package.json',
  'tsconfig.json',
  'src/App.tsx',
  'index.tsx'
];

console.log('=== Verificando Integridade do Projeto ASA ===');

let missing = 0;

filesToCheck.forEach(file => {
  // Ajuste simples para verificar na raiz ou src dependendo de onde o script roda
  const filePath = path.resolve('.', file);
  // Tenta encontrar também se estiver na raiz sem pasta src (estrutura plana)
  const flatPath = path.resolve('.', path.basename(file));
  
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} encontrado.`);
  } else if (fs.existsSync(flatPath)) {
    console.log(`✅ ${file} encontrado (na raiz).`);
  } else {
    console.log(`❌ ${file} ESTÁ FALTANDO.`);
    missing++;
  }
});

if (missing > 0) {
  console.log(`\n⚠️ Atenção: ${missing} arquivos críticos não foram encontrados.`);
} else {
  console.log('\n🎉 Todos os arquivos críticos parecem estar presentes.');
  console.log('Para iniciar o projeto:');
  console.log('1. npm install');
  console.log('2. npm run dev');
}
