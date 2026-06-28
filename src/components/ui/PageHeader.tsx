import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-900 border-l-4 border-primary-500 pl-3">
          {title}
        </h1>
        {description && (
          <p className="text-surface-500 text-sm mt-1">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-4 flex-shrink-0">{children}</div>
      )}
    </div>
  );
}
