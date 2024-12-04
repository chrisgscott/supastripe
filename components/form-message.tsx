export interface FormMessageProps {
  type?: 'success' | 'error' | 'info';
  message?: {
    type?: 'success' | 'error' | 'info';
    message?: string;
  };
}

export function FormMessage({ type = 'info', message }: FormMessageProps) {
  if (!message?.message) return null;

  const messageType = message.type || type;
  
  const borderColorClass = {
    success: 'border-foreground',
    error: 'border-destructive-foreground',
    info: 'border-foreground'
  }[messageType];

  const textColorClass = {
    success: 'text-foreground',
    error: 'text-destructive-foreground',
    info: 'text-foreground'
  }[messageType];

  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-sm">
      <div className={`${textColorClass} border-l-2 ${borderColorClass} px-4`}>
        {message.message}
      </div>
    </div>
  );
}
