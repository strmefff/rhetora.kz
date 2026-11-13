export const parseCSV = (csvText: string) => {
  const lines = csvText.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ''));
    const entry: Record<string, string> = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] || '';
    });
    return entry;
  });
};

export const generateCSV = (headers: string[], rows: (string | number)[][]) => {
  const headerRow = headers.join(',');
  const contentRows = rows.map(r => r.map(val => `"${val}"`).join(','));
  return [headerRow, ...contentRows].join('\n');
};
