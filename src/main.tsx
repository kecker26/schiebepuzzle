import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import MotionProvider from './motion/MotionProvider.tsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <MotionProvider>
      <App />
    </MotionProvider>
  </ThemeProvider>,
)
