import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main className="mx-auto my-16 max-w-160 px-6">
      <h1 className="text-3xl font-bold">Lingo</h1>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
