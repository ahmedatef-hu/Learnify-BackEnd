/**
 * Review Model
 * Represents student reviews for skill exchange sessions
 */

class Review {
    constructor(data) {
        this.id = data.id || null;
        this.studentId = data.studentId;
        this.sessionId = data.sessionId;
        this.rating = data.rating;
        this.comment = data.comment || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.studentName = data.studentName || null; // For joined queries
    }

    // Validation
    static validate(data) {
        const errors = [];

        if (!data.studentId) {
            errors.push('Student ID is required');
        }

        if (!data.sessionId) {
            errors.push('Session ID is required');
        }

        if (!data.rating || data.rating < 1 || data.rating > 5) {
            errors.push('Rating must be between 1 and 5');
        }

        if (data.comment && data.comment.length > 500) {
            errors.push('Comment must be less than 500 characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Convert to DTO for API response
    toDTO() {
        return {
            id: this.id,
            studentId: this.studentId,
            studentName: this.studentName,
            sessionId: this.sessionId,
            rating: this.rating,
            comment: this.comment,
            createdAt: this.createdAt
        };
    }
}

module.exports = Review;