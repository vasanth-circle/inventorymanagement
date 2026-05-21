
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

export const shareViaEmail = (order, settings, docType = 'quotation') => {
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? 'Quotation' : 'Invoice';
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const subject = encodeURIComponent(`${title} #${docNo} from ${settings?.companyName || 'Us'}`);
    const body = generateShareMessage(order, settings, docType);
    const email = order.customer?.email || '';
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
};
