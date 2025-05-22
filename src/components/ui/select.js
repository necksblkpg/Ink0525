import * as React from "react"

// Enkel dropdown-implementation som fungerar utan externa beroenden
const Select = React.forwardRef(({ className, children, value, onValueChange, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value || '');
  const [selectedLabel, setSelectedLabel] = React.useState('');
  const dropdownRef = React.useRef(null);

  // Uppdatera selectedValue när value ändras utifrån
  React.useEffect(() => {
    setSelectedValue(value || '');
  }, [value]);

  // Hitta label för valt värde
  React.useEffect(() => {
    // Hitta barnet (SelectItem) med matchande value
    React.Children.forEach(children, child => {
      if (React.isValidElement(child) && child.props.children) {
        React.Children.forEach(child.props.children, item => {
          if (React.isValidElement(item) && 
              item.type.displayName === 'SelectItem' && 
              item.props.value === selectedValue) {
            setSelectedLabel(item.props.children);
          }
        });
      }
    });
  }, [children, selectedValue]);

  // Stäng dropdown när man klickar utanför
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (newValue) => {
    setSelectedValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    setIsOpen(false);
  };

  return (
    <div 
      ref={dropdownRef}
      className={`relative ${className}`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer"
      >
        <span>{selectedLabel || 'Välj...'}</span>
        <span className="ml-2">{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-background shadow-lg">
          <div className="py-1">
            {React.Children.map(children, child => {
              if (React.isValidElement(child) && child.props.children) {
                return React.Children.map(child.props.children, item => {
                  if (React.isValidElement(item) && item.type.displayName === 'SelectItem') {
                    return React.cloneElement(item, {
                      onClick: () => handleSelect(item.props.value)
                    });
                  }
                  return null;
                });
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
});
Select.displayName = "Select";

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={`block truncate ${className}`}
      {...props}
    />
  );
});
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 ${className}`}
      {...props}
    >
      <div className="w-full p-1">
        {children}
      </div>
    </div>
  );
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef(({ className, children, onClick, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } 