import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Amplify }             from 'aws-amplify';
import awsExports               from './aws-exports';
import { Authenticator }        from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { createRoot } from 'react-dom/client';

// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// );

Amplify.configure(awsExports);

// Grab your root DOM node
const container = document.getElementById('root');

// Create the root and render
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Authenticator.Provider>
      <App />
    </Authenticator.Provider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
