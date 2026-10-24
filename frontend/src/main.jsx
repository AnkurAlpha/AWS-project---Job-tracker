import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SkeletonTheme } from "react-loading-skeleton";
import App from './App.jsx'
import './index.css'
import "react-loading-skeleton/dist/skeleton.css";
import { AuthProvider } from './auth/AuthContext.jsx'
import { applyTheme, getInitialTheme } from "./theme/useTheme.js";

applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <AuthProvider>
        <SkeletonTheme baseColor="rgba(203, 213, 225, 0.45)" highlightColor="rgba(255, 255, 255, 0.9)">
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SkeletonTheme>
      </AuthProvider>
    </React.StrictMode>
);

// previous things :
// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )
