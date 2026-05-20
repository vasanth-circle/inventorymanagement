import Counter from '../models/Counter.js';

/**
 * Gets the next sequence value for a given counter ID and tenant ID.
 * @param {string} id - The sequence identifier (e.g., 'quotation', 'PO')
 * @param {string} tenantId - The tenant's ID
 * @param {number} [maxSeq=1000] - When the counter exceeds this value it resets to startSeq
 * @param {number} [startSeq=1] - The value to restart from after exceeding maxSeq
 * @returns {Promise<number>} - The next sequence value
 */
export const getNextSequenceValue = async (id, tenantId, maxSeq = 1000, startSeq = 1) => {
    let sequenceDocument = await Counter.findOneAndUpdate(
        { id, tenantId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    // If sequence exceeds maxSeq, reset it back to startSeq
    if (sequenceDocument.seq > maxSeq) {
        sequenceDocument = await Counter.findOneAndUpdate(
            { id, tenantId },
            { $set: { seq: startSeq } },
            { new: true }
        );
    }
    
    return sequenceDocument.seq;
};

