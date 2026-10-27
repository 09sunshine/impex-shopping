import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

/**
 * Responsive & Scalable Language Toggle Component
 * Supports 'pill' (toggle between primary languages) or 'dropdown' (scalable for N languages)
 */
export default function LanguageToggle({ variant = 'pill', className = '', style = {} }) {
  const { language, setLanguage, languages, currentLanguageInfo } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown or tapped state on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setIsTapped(false);
      }
    }
    if (dropdownOpen || isTapped) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, isTapped]);

  // Collapsed globe initially, expands smoothly on hover/focus to show available languages
  if (variant === 'hover-expand' || variant === 'collapsed-globe') {
    const isExpanded = isHovered || isFocused || isTapped;

    return (
      <div
        ref={containerRef}
        className={`language-toggle-expandable ${isExpanded ? 'is-expanded' : ''} ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        role="group"
        aria-label="Language selection"
        style={style}
      >
        {/* Animated sliding container of available languages */}
        <div className="language-options-slider" aria-hidden={!isExpanded}>
          {languages.map((langItem) => {
            const isActive = language === langItem.code;
            return (
              <button
                key={langItem.code}
                type="button"
                onClick={() => {
                  setLanguage(langItem.code);
                  setIsTapped(false);
                }}
                className={`lang-option-btn ${isActive ? 'is-active' : ''}`}
                title={langItem.name}
                aria-pressed={isActive}
                tabIndex={isExpanded ? 0 : -1}
              >
                <span className="lang-flag">{langItem.flag}</span>
                <span className="lang-code">{langItem.short}</span>
              </button>
            );
          })}
        </div>

        {/* Globe trigger icon button (anchor) */}
        <button
          type="button"
          onClick={() => setIsTapped((prev) => !prev)}
          className="globe-trigger-btn"
          title={isExpanded ? 'Available Languages' : `Select Language (${currentLanguageInfo.short})`}
          aria-expanded={isExpanded}
          aria-label="Language selector"
        >
          <Globe size={18} />
        </button>
      </div>
    );
  }

  // Pill Segmented Toggle (FR | EN | HT)
  if (variant === 'pill') {
    return (
      <div
        className={`language-toggle-pill ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-muted, #f1f5f9)',
          borderRadius: '9999px',
          padding: '2px',
          border: '1px solid var(--border, #e2e8f0)',
          gap: '2px',
          userSelect: 'none',
          ...style,
        }}
        role="group"
        aria-label="Language selection"
      >
        {languages.map((langItem) => {
          const isActive = language === langItem.code;
          return (
            <button
              key={langItem.code}
              type="button"
              onClick={() => setLanguage(langItem.code)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary, #6366f1)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary, #475569)',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 1px 3px rgba(99, 102, 241, 0.3)' : 'none',
                lineHeight: 1.2,
              }}
              title={langItem.name}
              aria-pressed={isActive}
            >
              <span>{langItem.flag}</span>
              <span>{langItem.short}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Full Dropdown Menu Selector (Scalable for N languages)
  return (
    <div
      ref={containerRef}
      className={`language-toggle-dropdown ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border, #e2e8f0)',
          backgroundColor: '#ffffff',
          color: 'var(--text-primary, #0f172a)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
      >
        <span style={{ fontSize: '1rem' }}>{currentLanguageInfo.flag}</span>
        <span>{currentLanguageInfo.short}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted, #94a3b8)' }} />
      </button>

      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border, #e2e8f0)',
            minWidth: '160px',
            padding: '4px',
            zIndex: 100,
          }}
          role="listbox"
        >
          {languages.map((l) => {
            const isSelected = language === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setLanguage(l.code);
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? 'var(--primary-light, #eef2ff)' : 'transparent',
                  color: isSelected ? 'var(--primary, #6366f1)' : 'var(--text-primary, #0f172a)',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{l.flag}</span>
                  <span>{l.name}</span>
                </span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
