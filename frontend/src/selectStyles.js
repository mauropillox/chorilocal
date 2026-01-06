// Estilos compartidos para react-select con soporte dark mode
export const getSelectStyles = () => {
  const isDark = 
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && 
     document.documentElement.getAttribute('data-theme') !== 'light');

  return {
    control: (base) => ({ 
      ...base, 
      backgroundColor: isDark ? '#374151' : 'white', 
      borderColor: isDark ? '#4b5563' : '#d1d5db', 
      minHeight: '44px',
      color: isDark ? '#f9fafb' : '#1f2937'
    }),
    singleValue: (base) => ({ ...base, color: isDark ? '#f9fafb' : '#1f2937' }),
    input: (base) => ({ ...base, color: isDark ? '#f9fafb' : '#1f2937' }),
    placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
    option: (base, state) => ({ 
      ...base, 
      backgroundColor: state.isSelected 
        ? '#3b82f6' 
        : state.isFocused 
          ? (isDark ? '#4b5563' : '#e0e7ff') 
          : (isDark ? '#1f2937' : 'white'), 
      color: state.isSelected ? 'white' : (isDark ? '#f9fafb' : '#1f2937')
    }),
    menu: (base) => ({ 
      ...base, 
      zIndex: 50, 
      backgroundColor: isDark ? '#1f2937' : 'white', 
      border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db' 
    }),
    menuList: (base) => ({ ...base, backgroundColor: isDark ? '#1f2937' : 'white' })
  };
};
