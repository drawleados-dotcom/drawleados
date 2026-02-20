import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor }
  ];

  const currentTheme = themes.find(t => t.id === theme);
  const CurrentIcon = currentTheme?.icon || Moon;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="theme-toggle-btn"
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#18181b] dark:bg-[#18181b] light:bg-white border border-[#27272a] dark:border-[#27272a] light:border-gray-200 hover:bg-[#27272a] dark:hover:bg-[#27272a] light:hover:bg-gray-100 transition-colors"
      >
        <CurrentIcon className="h-4 w-4 text-[#a1a1aa] dark:text-[#a1a1aa] light:text-gray-600" />
        <span className="text-sm text-[#a1a1aa] dark:text-[#a1a1aa] light:text-gray-600 hidden sm:inline">
          {currentTheme?.label}
        </span>
        <ChevronDown className={`h-3 w-3 text-[#52525b] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-36 bg-[#18181b] dark:bg-[#18181b] light:bg-white border border-[#27272a] dark:border-[#27272a] light:border-gray-200 rounded-lg shadow-lg py-1 z-50">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isActive = theme === themeOption.id;
            
            return (
              <button
                key={themeOption.id}
                onClick={() => {
                  setTheme(themeOption.id);
                  setIsOpen(false);
                }}
                data-testid={`theme-option-${themeOption.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive 
                    ? 'bg-[#6366f1]/20 text-[#6366f1]' 
                    : 'text-[#a1a1aa] dark:text-[#a1a1aa] light:text-gray-600 hover:bg-[#27272a] dark:hover:bg-[#27272a] light:hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{themeOption.label}</span>
                {isActive && (
                  <span className="ml-auto text-[#6366f1]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
