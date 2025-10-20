import { BlurGradientBg } from 'react-color4bg';
import { RouterProvider } from 'react-router-dom';
import Web3Provider from './providers/Web3Provider';
import router from './router';

function App() {
  return (
    <Web3Provider>
      <div style={{ width: '100%', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <BlurGradientBg
          style={{ 
            width: '100vw', 
            minHeight: '100vh', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            zIndex: 0,
            background: 'linear-gradient(135deg, #D1ADFF 0%, #98D69B 25%, #FAE390 50%, #FFACD8 75%, #7DD5FF 100%)'
          }}
          colors={["#D1ADFF", "#98D69B", "#FAE390", "#FFACD8", "#7DD5FF", "#D1ADFF"]}
          loop
        />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh', overflowX: 'hidden' }}>
          <RouterProvider router={router} />
        </div>
      </div>
    </Web3Provider>
  );
}

export default App;