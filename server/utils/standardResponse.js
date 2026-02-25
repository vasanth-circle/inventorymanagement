export const sendResponse = (res, statusCode, data, message = '') => {
    res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

export const sendError = (res, statusCode, message, errors = null) => {
    res.status(statusCode).json({
        success: false,
        message,
        errors
    });
};
