import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Pagination({ className, ...props }) {
    return (_jsx("nav", { role: "navigation", "aria-label": "pagination", "data-slot": "pagination", className: cn('mx-auto flex w-full justify-center', className), ...props }));
}
function PaginationContent({ className, ...props }) {
    return (_jsx("ul", { "data-slot": "pagination-content", className: cn('flex flex-row items-center gap-1', className), ...props }));
}
function PaginationItem({ ...props }) {
    return _jsx("li", { "data-slot": "pagination-item", ...props });
}
function PaginationLink({ className, isActive, isDisabled, size = 'icon', ...props }) {
    return (_jsx("a", { "aria-current": isActive ? 'page' : undefined, "data-slot": "pagination-link", "data-active": isActive, "data-disabled": isDisabled, className: cn(buttonVariants({
            variant: isActive ? 'outline' : 'ghost',
            size,
        }), isDisabled && 'pointer-events-none opacity-50', className), ...props }));
}
function PaginationPrevious({ className, isDisabled, ...props }) {
    return (_jsxs(PaginationLink, { "aria-label": "Oldingi sahifaga o'tish", size: "default", className: cn('gap-1 px-2.5 sm:pl-2.5', className), isDisabled: isDisabled, ...props, children: [_jsx(ChevronLeftIcon, {}), _jsx("span", { className: "hidden sm:block", children: "Oldingi" })] }));
}
function PaginationNext({ className, isDisabled, ...props }) {
    return (_jsxs(PaginationLink, { "aria-label": "Keyingi sahifaga o'tish", size: "default", className: cn('gap-1 px-2.5 sm:pr-2.5', className), isDisabled: isDisabled, ...props, children: [_jsx("span", { className: "hidden sm:block", children: "Keyingi" }), _jsx(ChevronRightIcon, {})] }));
}
function PaginationEllipsis({ className, ...props }) {
    return (_jsxs("span", { "aria-hidden": true, "data-slot": "pagination-ellipsis", className: cn('flex size-9 items-center justify-center', className), ...props, children: [_jsx(MoreHorizontalIcon, { className: "size-4" }), _jsx("span", { className: "sr-only", children: "Boshqa sahifalar" })] }));
}

function getVisiblePages(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', total];
    if (current >= total - 3) return [1, 'ellipsis-start', total - 4, total - 3, total - 2, total - 1, total];
    return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

const PaginationComponent = ({ currentPage, totalPages, baseUrl, }) => {
    if (totalPages <= 1) return null;
    const items = getVisiblePages(currentPage, totalPages);
    const getPageUrl = (page) => {
        if (page === 1)
            return baseUrl;
        return `${baseUrl}${page}`;
    };
    return (_jsx(Pagination, { children: _jsxs(PaginationContent, { className: "flex-wrap", children: [
        _jsx(PaginationItem, { children: _jsx(PaginationPrevious, { href: currentPage > 1 ? getPageUrl(currentPage - 1) : undefined, isDisabled: currentPage === 1 }) }),
        items.map((item, idx) => {
            if (typeof item === 'string') {
                return _jsx(PaginationItem, { children: _jsx(PaginationEllipsis, {}) }, `${item}-${idx}`);
            }
            return (_jsx(PaginationItem, { children: _jsx(PaginationLink, { href: getPageUrl(item), isActive: item === currentPage, children: item }) }, item));
        }),
        _jsx(PaginationItem, { children: _jsx(PaginationNext, { href: currentPage < totalPages ? getPageUrl(currentPage + 1) : undefined, isDisabled: currentPage === totalPages }) })
    ] }) }));
};

export default PaginationComponent;
export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis, };
