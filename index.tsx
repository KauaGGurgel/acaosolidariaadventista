import React from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:50px">Erro Fatal: Elemento root não encontrado.</h1>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Erro ao renderizar:', error);
    rootElement.innerHTML = `<div style="padding:20px;text-align:center"><h2>Erro ao iniciar App</h2><p>${String(error)}</p></div>`;
  }
}
