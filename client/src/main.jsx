import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// Prevent numeric values from changing on mouse wheel scroll
document.addEventListener('wheel', function(event) {
    if (document.activeElement.type === 'number') {
        document.activeElement.blur();
    }
});

// Cache buster: 1
