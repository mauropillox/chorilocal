import { useState } from 'react';
import { toggleTheme } from '../utils';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const handleToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="btn-secondary"
      title={`Toggle theme (current: ${theme})`}
      style={{ padding: '8px 12px' }}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
