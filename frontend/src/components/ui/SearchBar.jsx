import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

function SearchBar({ 
  placeholder = 'Search by title, author, subject, or ISBN...',
  onSearch,
  value: controlledValue,
  onChange: controlledChange,
  showSuggestions = true,
  className = '',
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const isControlled = controlledValue !== undefined;

  const currentValue = isControlled ? controlledValue : query;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    if (!isControlled) setQuery(value);
    controlledChange?.(value);

    // Debounced search suggestions
    if (showSuggestions && value.length >= 2) {
      // In a real app, you'd debounce this
      setShowDropdown(true);
      setSelectedIndex(-1);
    } else {
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    const value = typeof suggestion === 'string' ? suggestion : suggestion.title;
    if (!isControlled) setQuery(value);
    controlledChange?.(value);
    handleSubmit(new Event('submit', { cancelable: true }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentValue.trim()) {
      onSearch?.(currentValue.trim());
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    if (!isControlled) setQuery('');
    controlledChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-faint)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={currentValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => currentValue.length >= 2 && setShowDropdown(true)}
            placeholder={placeholder}
            className="input pl-12 pr-12"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-expanded={showDropdown && suggestions.length > 0}
          />
          {currentValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 text-left transition-colors ${
                index === selectedIndex ? 'bg-[var(--surface-2)]' : ''
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              {typeof suggestion === 'string' ? suggestion : suggestion.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;