
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Override every existing style and set the page background to solid white
document.documentElement.style.setProperty('background', '#ffffff', 'important');
document.body.style.setProperty('background', '#ffffff', 'important');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
