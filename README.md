# Sistema de Gestão ASA (Ação Solidária Adventista)

Este é um sistema de gestão completo para controle de beneficiários, estoque de alimentos e montagem de cestas básicas, integrado com IA (Gemini) para mensagens espirituais.

## 📁 Estrutura de Arquivos

O projeto contém os seguintes arquivos principais:

*   **index.html**: Ponto de entrada da aplicação.
*   **index.tsx**: Inicialização do React.
*   **App.tsx**: Componente principal e rotas.
*   **vite.config.ts**: Configuração do bundler Vite.
*   **components/**: Pasta com os componentes do sistema (Dashboard, Estoque, Pessoas, etc).

## 🚀 Como Rodar Localmente

1.  Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.
2.  Abra o terminal na pasta do projeto.
3.  Instale as dependências:
    ```bash
    npm install
    ```
4.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
5.  Acesse o link mostrado no terminal (geralmente `http://localhost:5173`).

## 🛠️ Solução de Problemas

Se você ver uma **Tela Branca**:
1.  Verifique se o `index.html` não tem tags `<script type="importmap">`. Se tiver, apague-as.
2.  Verifique se o arquivo `vite.config.ts` tem `base: './'`.

## 📦 Deploy

Para colocar no GitHub Pages:
1.  Faça commit das alterações.
2.  O GitHub Actions configurado em `.github/workflows/deploy.yml` fará o resto automaticamente.
