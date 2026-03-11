import React, { useEffect, useRef, useState } from 'react';

export type DropdownOption = {
  value: string;
  label: string;
  description?: string;
};

type CustomDropdownProps = {
  name: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  theme?: 'light' | 'dark';
  size?: 'default' | 'compact';
  renderSelected?: (option: DropdownOption) => React.ReactNode;
  renderOption?: (option: DropdownOption, selected: boolean) => React.ReactNode;
  className?: string;
  menuClassName?: string;
};

export default function CustomDropdown({
  name,
  options,
  value,
  defaultValue = '',
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  onChange,
  theme = 'light',
  size = 'default',
  renderSelected,
  renderOption,
  className = '',
  menuClassName = ''
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedValue(value ?? defaultValue);
  }, [value, defaultValue]);

  useEffect(() => {
    if (!isOpen || disabled) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [disabled, isOpen]);

  const selectedOption = options.find((option) => option.value === selectedValue);
  const isDark = theme === 'dark';
  const isCompact = size === 'compact';

  const triggerClassName = className || (
    isDark
      ? `flex w-full items-center gap-3 rounded-xl border border-gray-600 bg-gray-700 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-left text-white shadow-sm transition ${disabled ? 'cursor-not-allowed opacity-60' : isOpen ? 'ring-2 ring-gray-400' : 'hover:border-gray-500'}`
      : `flex w-full items-center gap-3 rounded-xl border border-stone-300 bg-white ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-left shadow-sm transition ${disabled ? 'cursor-not-allowed opacity-60' : isOpen ? 'ring-2 ring-stone-500' : 'hover:border-stone-400'}`
  );
  const dropdownMenuClassName = menuClassName || (
    isDark
      ? 'absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-600 bg-gray-800 shadow-2xl'
      : 'absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl'
  );

  return (
    <div className="relative" ref={containerRef}>
      <select
        name={name}
        value={selectedValue}
        onChange={(event) => {
          setSelectedValue(event.target.value);
          onChange?.(event.target.value);
        }}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value || 'empty'}`} value={option.value}>
            {option.description ? `${option.label} - ${option.description}` : option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((open) => !open);
        }}
        className={triggerClassName}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            renderSelected ? (
              renderSelected(selectedOption)
            ) : (
              <span className={`block truncate ${isDark ? 'text-white' : 'text-stone-900'} ${isCompact ? 'text-sm' : ''}`}>
                {selectedOption.label}
              </span>
            )
          ) : (
            <span className={`block truncate ${isDark ? 'text-gray-400' : 'text-stone-500'} ${isCompact ? 'text-sm' : ''}`}>
              {placeholder}
            </span>
          )}
        </div>
        <span className={`material-symbols-rounded shrink-0 select-none transition-transform ${isDark ? 'text-gray-300' : 'text-stone-500'} ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {isOpen && !disabled ? (
        <div className={dropdownMenuClassName}>
          <div className="max-h-[min(18rem,40vh)] overflow-y-auto py-2">
            {options.map((option) => {
              const isSelected = selectedValue === option.value;
              return (
                <button
                  key={`${name}-option-${option.value || 'empty'}`}
                  type="button"
                  onClick={() => {
                    setSelectedValue(option.value);
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 ${isCompact ? 'py-2.5' : 'py-3'} text-left transition ${
                    isDark
                      ? isSelected
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-700/70'
                      : isSelected
                        ? 'bg-stone-100'
                        : 'hover:bg-stone-50'
                  }`}
                  title={option.description ? `${option.label} - ${option.description}` : option.label}
                >
                  <div className="min-w-0 flex-1">
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <>
                        <div className={`truncate ${isDark ? 'text-white' : 'text-stone-900'} ${isCompact ? 'text-sm' : ''}`}>
                          {option.label}
                        </div>
                        {option.description ? (
                          <div className={`truncate text-sm ${isDark ? 'text-gray-400' : 'text-stone-500'}`}>
                            {option.description}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  {isSelected ? (
                    <span className={`material-symbols-rounded select-none ${isDark ? 'text-gray-200' : 'text-stone-700'}`}>
                      check
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
