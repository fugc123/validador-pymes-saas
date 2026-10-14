export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csvContent = [
    keys.join(","),
    ...rows.map(row => keys.map(k => {
      let cell = (row as any)[k] == null ? "" : String((row as any)[k]);
      cell = cell.replace(/"/g, '""');
      if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
      return cell;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
