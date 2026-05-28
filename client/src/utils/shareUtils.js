
import { printDocument } from './printTemplates';

export const generateShareMessage = (order, settings, docType = 'quotation') => {
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? 'Quotation' : 'Invoice';
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const company = settings?.companyName || 'Our Company';
    const total = (order.totalAmount || 0).toLocaleString('en-IN');
    const currency = settings?.documentConfig?.currencySymbol || '₹';

    let message = `*${title} from ${company}*\n\n`;
    message += `*No:* ${docNo}\n`;
    message += `*Date:* ${new Date(order.quotationDate || order.orderDate || order.createdAt).toLocaleDateString()}\n`;
    message += `*Customer:* ${order.customer?.companyName || order.customer?.name || 'Customer'}\n`;
    message += `--------------------------\n`;
    
    order.items.slice(0, 5).forEach(item => {
        message += `• ${item.name}: ${item.quantity} ${item.unit || ''} @ ${currency}${item.price}\n`;
    });
    
    if (order.items.length > 5) {
        message += `... and ${order.items.length - 5} more items\n`;
    }

    message += `--------------------------\n`;
    message += `*Total Amount: ${currency}${total}*\n\n`;
    
    if (order.terms) {
        message += `*Terms:* ${order.terms}\n\n`;
    }

    message += `Thank you for your business!`;
    
    return encodeURIComponent(message);
};

export const shareViaWhatsApp = (order, settings, docType = 'quotation') => {
    const message = generateShareMessage(order, settings, docType);
    const phone = order.customer?.phone ? order.customer.phone.replace(/\D/g, '') : '';
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
};

/**
 * Share invoice as PDF directly using Web Share API with files.
 * On mobile (Android/iOS), generates the invoice HTML blob and shares it
 * as a file. The OS handles opening/saving as PDF.
 * Falls back to opening print dialog on desktop.
 */
export const shareInvoiceAsPdf = async (order, settings, docType = 'quotation', generateHtmlFn) => {
    const docNo = order.orderNumber;
    const docTitle = docType === 'quotation' ? 'Quotation' : 'Invoice';
    const fileName = `${docTitle}-${docNo}.html`;

    try {
        // Generate the invoice HTML
        const html = generateHtmlFn(order, settings, docType);
        const blob = new Blob([html], { type: 'text/html' });
        const file = new File([blob], fileName, { type: 'text/html' });

        // Try Web Share API with file support (Android Chrome, iOS Safari 15+)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${docTitle} #${docNo}`,
                text: `${docTitle} from ${settings?.companyName || 'Us'} — ${order.customer?.companyName || order.customer?.name} — ₹${(order.totalAmount || 0).toLocaleString('en-IN')}`,
                files: [file],
            });
            return;
        }

        // Fallback: open in new window and trigger print (user can Save as PDF)
        const w = window.open('', '_blank', 'width=950,height=750');
        if (w) {
            w.document.write(html);
            w.document.close();
            setTimeout(() => { w.focus(); w.print(); }, 600);
        }
    } catch (err) {
        if (err?.name !== 'AbortError') {
            console.error('Share PDF error:', err);
            // Fallback to standard print
            printDocument(order, settings, docType);
        }
    }
};

export const shareViaEmail = (order, settings, docType = 'quotation') => {
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? 'Quotation' : 'Invoice';
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const subject = encodeURIComponent(`${title} #${docNo} from ${settings?.companyName || 'Us'}`);
    const body = generateShareMessage(order, settings, docType);
    const email = order.customer?.email || '';
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
};
