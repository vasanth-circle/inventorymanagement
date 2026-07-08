import Tesseract from 'tesseract.js'; // Requires tesseract.js installation if using local

export const extractInvoiceData = async (imageBuffer, tenantId) => {
    try {
        console.log('[OCR] Extracting data from image...');
        // For demonstration, simulating OCR extraction to avoid heavy local processing time
        // In real app:
        // const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
        // return parseOcrText(text, tenantId);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
            vendorName: "Simulated OCR Vendor",
            invoiceNumber: "INV-" + Math.floor(Math.random() * 10000),
            date: new Date().toISOString().split('T')[0],
            items: [
                { name: "Scanned Item 1", quantity: 10, price: 150 },
                { name: "Scanned Item 2", quantity: 5, price: 200 }
            ],
            totalAmount: 2500
        };
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to process image');
    }
};
