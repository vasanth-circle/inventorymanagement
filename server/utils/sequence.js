import Counter from '../models/Counter.js';

/**
 * Gets the next sequence value for a given counter ID and tenant ID.
 * @param {string} id - The sequence identifier (e.g., 'PO', 'SO')
 * @param {string} tenantId - The tenant's ID
 * @returns {Promise<number>} - The next sequence value
 */
export const getNextSequenceValue = async (id, tenantId) => {
    const sequenceDocument = await Counter.findOneAndUpdate(
        { id, tenantId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.seq;
};
