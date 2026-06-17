export const allocateFIFO = (itemDoc, requiredQty) => {
    let remaining = requiredQty;
    const allocations = [];

    if (!itemDoc.batches || itemDoc.batches.length === 0) {
        // Fallback if no batches exist
        allocations.push({
            batchId: null,
            batchNumber: 'LEGACY',
            quantity: remaining,
            purchasePrice: itemDoc.purchasePrice || 0
        });
        return allocations;
    }

    // Sort batches by receivedDate (oldest first)
    // Create a shallow copy to avoid mutating the mongoose array order directly during iteration
    const sortedBatches = [...itemDoc.batches].sort((a, b) => {
        const dateA = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
        const dateB = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
        return dateA - dateB;
    });

    for (const batch of sortedBatches) {
        if (remaining <= 0) break;
        if (batch.quantity > 0) {
            const deduct = Math.min(batch.quantity, remaining);
            // We mutate the actual batch quantity here. Mongoose will track it.
            // Since sortedBatches is a shallow copy of itemDoc.batches, the objects are the same references.
            batch.quantity -= deduct;
            remaining -= deduct;
            allocations.push({
                batchId: batch._id,
                batchNumber: batch.batchNumber,
                quantity: deduct,
                purchasePrice: batch.price || itemDoc.purchasePrice || 0
            });
        }
    }

    // If there's still remaining quantity (e.g., negative stock allowed)
    if (remaining > 0) {
        allocations.push({
            batchId: null,
            batchNumber: 'OVERDRAWN',
            quantity: remaining,
            purchasePrice: itemDoc.purchasePrice || 0
        });
    }

    return allocations;
};
