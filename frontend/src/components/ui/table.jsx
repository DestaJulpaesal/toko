import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }) {
  return <tfoot className={cn("border-t bg-muted/50 font-medium", className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return <tr className={cn("border-b border-border transition-colors hover:bg-muted/50", className)} {...props} />;
}

function TableHead({ className, ...props }) {
  return <th className={cn("h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

function TableCell({ className, ...props }) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

function TableCaption({ className, ...props }) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
