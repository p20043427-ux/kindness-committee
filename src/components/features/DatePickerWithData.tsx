import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface DatePickerWithDataProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

export function DatePickerWithData({ selectedDate, onDateChange }: DatePickerWithDataProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isOpen && 
        buttonRef.current && 
        popoverRef.current && 
        !buttonRef.current.contains(target) && 
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      onDateChange(`${yyyy}-${mm}-${dd}`);
      setIsOpen(false);
    }
  };

  const selectedStrDate = selectedDate ? parseISO(selectedDate) : undefined;

  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Recalculate position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      setPopoverStyle({
        top: rect.bottom + window.scrollY + 8,
        left: isMobile ? rect.left + window.scrollX - 40 : rect.left + window.scrollX - 160,
      });
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 px-4 py-2 border border-surface-300 rounded-lg text-sm bg-white hover:bg-surface-50 focus:ring-2 focus:ring-primary-500 outline-none text-surface-700 font-medium transition-colors w-full sm:w-auto min-w-[140px] flex-shrink-0"
        )}
      >
        <CalendarIcon className="w-4 h-4 text-surface-500 flex-shrink-0" />
        <span className="truncate">{selectedDate ? selectedDate : "날짜 선택"}</span>
      </button>

      {isOpen && createPortal(
        <div 
          ref={popoverRef}
          style={popoverStyle}
          className="absolute z-[9999] bg-white border border-surface-200 rounded-xl shadow-xl p-3"
        >
          <style>{`
            .rdp {
              --rdp-cell-size: 40px;
              --rdp-accent-color: #3b82f6;
              --rdp-background-color: #eff6ff; 
              margin: 0;
            }
            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
              background-color: #4f46e5;
              color: white;
            }
            .day-with-data::after {
              content: '';
              display: block;
              width: 6px;
              height: 6px;
              background-color: #10b981;
              border-radius: 50%;
              position: absolute;
              bottom: 4px;
              left: 50%;
              transform: translateX(-50%);
            }
            .rdp-day {
              position: relative;
            }
          `}</style>
          <DayPicker
            mode="single"
            selected={selectedStrDate}
            onSelect={handleSelect}
            showOutsideDays
          />
        </div>,
        document.body
      )}
    </>
  );
}
