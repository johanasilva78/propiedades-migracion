import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Home from './pages/Home';
import { Amplify } from 'aws-amplify';

async function configureAmplify() {
  try {
    const modules = import.meta.glob('../amplify/outputs/amplify_outputs.json', { eager: true, import: 'default' });
    const config = modules['../amplify/outputs/amplify_outputs.json'] || {};
    if (config && Object.keys(config).length > 0) {
      Amplify.configure(config);
    } else {
      console.info('Amplify outputs not found or empty; running in local mode.');
    }
  } catch (error) {
    console.info('Amplify config skipped (no outputs).');
  }
}

configureAmplify();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>
);
