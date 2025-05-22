import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext({});

export function Tabs({ defaultValue, className, children, ...props }) {
  const [value, setValue] = useState(defaultValue);
  
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={`${className || ''}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children, ...props }) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children, ...props }) {
  const { value: selectedValue, setValue } = useContext(TabsContext);
  const isSelected = selectedValue === value;
  
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isSelected ? 'bg-background text-foreground shadow-sm' : ''} ${className || ''}`}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children, ...props }) {
  const { value: selectedValue } = useContext(TabsContext);
  const isSelected = selectedValue === value;
  
  if (!isSelected) return null;
  
  return (
    <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ''}`} {...props}>
      {children}
    </div>
  );
} 