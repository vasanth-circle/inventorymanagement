/**
 * Valid transitions for entities.
 * The key is the current state, and the array contains the allowed next states.
 */
export const STATE_MACHINES = {
    SalesOrder: {
        'quotation': ['confirmed', 'cancelled', 'void'],
        'confirmed': ['packed', 'dispatched', 'partially_dispatched', 'cancelled', 'void'],
        'packed': ['shipped', 'dispatched', 'void'],
        'partially_dispatched': ['dispatched', 'completed', 'void'],
        'dispatched': ['delivered', 'invoiced', 'void'],
        'shipped': ['delivered', 'void'],
        'delivered': ['invoiced', 'completed', 'void'],
        'invoiced': ['completed', 'void'],
        'draft': ['quotation', 'confirmed', 'void'],
        'completed': ['void'],
        'cancelled': [],
        'void': []
    },
    PurchaseOrder: {
        'draft': ['issued', 'void'],
        'issued': ['received', 'void'],
        'received': ['billed', 'void'],
        'billed': ['void'],
        'void': []
    }
};

/**
 * Validates a state transition.
 * @param {string} entity - 'SalesOrder' or 'PurchaseOrder'
 * @param {string} currentState - The current status of the document
 * @param {string} targetState - The new status requested
 * @returns {boolean} - true if transition is valid
 */
export const isValidTransition = (entity, currentState, targetState) => {
    // If state isn't changing, it's valid
    if (currentState === targetState) return true;
    
    const machine = STATE_MACHINES[entity];
    if (!machine) return true; // If no machine defined, allow it (for backward compatibility)

    const allowedNextStates = machine[currentState] || [];
    return allowedNextStates.includes(targetState);
};
