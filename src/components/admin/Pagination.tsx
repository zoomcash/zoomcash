import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 15;

interface PaginationProps {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export const Pagination = ({ page, total, onPageChange }: PaginationProps) => {
  const pages = totalPages(total);
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs text-muted-foreground">
        Página {page} de {pages} ({total} registros)
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          let p: number;
          if (pages <= 5) {
            p = i + 1;
          } else if (page <= 3) {
            p = i + 1;
          } else if (page >= pages - 2) {
            p = pages - 4 + i;
          } else {
            p = page - 2 + i;
          }
          return (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(p)}
              className="h-8 w-8 p-0 text-xs"
            >
              {p}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
