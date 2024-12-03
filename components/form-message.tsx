export interface FormMessageProps {
  type?: 'success' | 'error' | 'info';
  children: React.ReactNode;
}

export function FormMessage({ type = 'info', children }: FormMessageProps) {
  const borderColorClass = {
    success: 'border-foreground',
    error: 'border-destructive-foreground',
    info: 'border-foreground'
  }[type];

  const textColorClass = {
    success: 'text-foreground',
    error: 'text-destructive-foreground',
    info: 'text-foreground'
  }[type];

  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-sm">
      <div className={`${textColorClass} border-l-2 ${borderColorClass} px-4`}>
        {children}
      </div>
    </div>
  );
}
