import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional node rendered below the description on the left (e.g. a focus badge). */
  badge?: React.ReactNode;
  /** Right-side action controls. */
  children?: React.ReactNode;
}

export function PageHeader({ title, description, badge, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-surface-200">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-0.5 self-stretch bg-primary-600 rounded-full shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-surface-900 leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-surface-500 text-xs mt-0.5 leading-relaxed">{description}</p>
          )}
          {badge && <div className="mt-2">{badge}</div>}
        </div>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{children}</div>
      )}
    </div>
  );
}
