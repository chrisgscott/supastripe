import { cn } from "@/lib/utils";

interface StepsProps {
  steps: string[];
  currentStep: number;
}

export function Steps({ steps, currentStep }: StepsProps) {
  return (
    <div className="flex items-center space-x-4">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              "h-8 w-8 rounded-full border-2 flex items-center justify-center",
              currentStep === index
                ? "border-primary bg-primary text-primary-foreground"
                : currentStep > index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground text-muted-foreground"
            )}
          >
            {index + 1}
          </div>
          <span
            className={cn(
              "ml-2",
              currentStep === index
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "ml-4 h-0.5 w-10",
                currentStep > index ? "bg-primary" : "bg-muted-foreground"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}