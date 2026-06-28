import * as XLSX from "xlsx";

interface ExcelSheetData {
  headers: string[];
  rows: (string | number | null)[][];
  sheetName?: string;
}

export function downloadExcel(sheets: ExcelSheetData[], filename: string): void {
  try {
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ headers, rows, sheetName = "Sheet1" }) => {
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);

      const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddr]) continue;
        ws[cellAddr].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4338CA" } }, // indigo-700: 테마 primary 색상
          alignment: { horizontal: "center", vertical: "center" },
          border: { bottom: { style: "thin", color: { rgb: "cccccc" } } },
        };
      }

      const colWidths = headers.map((h, ci) => {
        const maxLen = rows.reduce((acc, row) => {
          const val = String(row[ci] ?? "");
          return Math.max(acc, val.length);
        }, h.length);
        return { wch: Math.min(40, Math.max(8, maxLen + 2)) };
      });
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, filename);
  } catch (e) {
    console.error("Excel 내보내기 오류:", e);
    throw e; // 호출부에서 toast 처리
  }
}
