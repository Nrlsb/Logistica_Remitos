const fs = require('fs');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Starting script...');
const xmlFilePath = path.join(__dirname, 'scat7160.xml');
console.log('XML Path:', xmlFilePath);

if (!fs.existsSync(xmlFilePath)) {
    console.error('File not found:', xmlFilePath);
    process.exit(1);
}

async function importBarcodes() {
    try {
        console.log('Reading file...');
        const xmlData = fs.readFileSync(xmlFilePath, 'utf8');
        console.log('File read, length:', xmlData.length);

        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, mergeAttrs: true, stripPrefix: true });

        console.log('Parsing XML...');
        const result = await parser.parseStringPromise(xmlData);

        // Navigate the structure: Workbook -> Worksheet -> Table -> Row
        // Note: Depending on xml2js options, arrays might be objects if only one item. 
        // But Row is likely an array.

        const worksheet = result.Workbook.Worksheet;
        // Worksheet might be an array if multiple sheets, but here likely one.
        // The file shows <Worksheet ss:Name="SCAT7160.XML">

        const table = worksheet.Table || worksheet[0].Table;
        const rows = table.Row;

        if (!rows || !Array.isArray(rows)) {
            console.error('Could not find rows in XML');
            return;
        }

        console.log(`Found ${rows.length} rows.`);

        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        // Start from index 1 to skip header if first row is header
        // Row 0: Codigo, Descripcion, Cod. Barras
        const startIndex = 1;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.Cell;

            // Cells might be an array or single object. 
            // Also empty cells might be missing or have different structure.
            // We expect 3 columns.
            // Cell[0] -> Code
            // Cell[1] -> Description
            // Cell[2] -> Barcode

            // Handle sparse cells if necessary, but Excel XML usually outputs them in order or with Index attribute.
            // Let's map cells to an array of values for easier access.

            let cellValues = [];
            if (Array.isArray(cells)) {
                cellValues = cells.map(c => {
                    if (!c.Data) return '';
                    if (typeof c.Data === 'string') return c.Data;
                    return c.Data._ || '';
                });
            } else if (cells) {
                // Single cell? Unlikely for this 3-col row but possible if others empty
                const c = cells;
                let val = '';
                if (c.Data) {
                    if (typeof c.Data === 'string') val = c.Data;
                    else val = c.Data._ || '';
                }
                cellValues.push(val);
            }

            // We need at least Code (index 0)
            const code = String(cellValues[0] || '').trim();
            let barcode = String(cellValues[2] || '').trim();

            if (!code) {
                skippedCount++;
                continue;
            }

            // If barcode is empty string, make it null
            if (!barcode || barcode === '') {
                barcode = null;
            }

            // Update Supabase
            // We update the product with this code.
            // Note: We are assuming the column 'barcode' exists. 
            // If the user hasn't run the migration yet, this might fail or just do nothing if we don't select it?
            // Actually 'update' will fail if column doesn't exist.

            const { error } = await supabase
                .from('products')
                .update({ barcode: barcode })
                .eq('code', code);

            if (error) {
                console.error(`Error updating code ${code}:`, error.message);
                errorCount++;
            } else {
                updatedCount++;
                if (updatedCount % 100 === 0) {
                    process.stdout.write(`\rUpdated: ${updatedCount}, Errors: ${errorCount}`);
                }
            }
        }

        console.log('\nImport complete.');
        console.log(`Updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Skipped: ${skippedCount}`);

    } catch (error) {
        console.error('Error processing file:', error);
    }
}

importBarcodes();
