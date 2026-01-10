import React from 'react';

interface ThemeSwitcherProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, onThemeChange }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => onThemeChange('light')}
        className={`px-3 py-1 rounded transition-colors ${
          theme === 'light'
            ? 'bg-yellow-400 text-gray-900'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        title="Light mode"
        aria-label="Light mode"
      >
        ☀️
      </button>
      <button
        onClick={() => onThemeChange('dark')}
        className={`px-3 py-1 rounded transition-colors ${
          theme === 'dark'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        title="Dark mode"
        aria-label="Dark mode"
      >
        🌙
      </button>
      <button
        onClick={() => onThemeChange('system')}
        className={`px-3 py-1 rounded transition-colors ${
          theme === 'system'
            ? 'bg-purple-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
        title="System preference"
        aria-label="System preference"
      >
        🖥️
      </button>
    </div>
  );
};
