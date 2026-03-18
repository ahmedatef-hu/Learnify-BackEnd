/**
 * Review Service
 * Business logic for review operations
 */

const Review = require('../models/Review');
const DatabaseService = require('./DatabaseService');

class ReviewService {
    constructor() {
        this.db = new DatabaseService();
    }

    // Create a new review
    async createReview(reviewData) {
        try {
            // Validate input
            const validation = Review.validate(reviewData);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if student already reviewed this session
            const existingReview = await this.db.findOne('reviews', {
                studentId: reviewData.studentId,
                sessionId: reviewData.sessionId
            });

            if (existingReview) {
                throw new Error('Student has already reviewed this session');
            }

            // Create review
            const review = new Review(reviewData);
            const reviewId = await this.db.create('reviews', {
                studentId: review.studentId,
                sessionId: review.sessionId,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt
            });

            review.id = reviewId;
            return review.toDTO();
        } catch (error) {
            console.error('Error creating review:', error);
            throw error;
        }
    }

    // Get reviews for a session
    async getSessionReviews(sessionId, page = 1, limit = 10, sortBy = 'newest') {
        try {
            let orderBy = 'createdAt DESC'; // Default: newest first
            
            if (sortBy === 'rating_high') {
                orderBy = 'rating DESC, createdAt DESC';
            } else if (sortBy === 'rating_low') {
                orderBy = 'rating ASC, createdAt DESC';
            } else if (sortBy === 'oldest') {
                orderBy = 'createdAt ASC';
            }

            const offset = (page - 1) * limit;
            
            // Get reviews with student names (simulated join)
            const reviews = await this.db.findMany('reviews', 
                { sessionId }, 
                { orderBy, limit, offset }
            );

            // Get total count for pagination
            const totalCount = await this.db.count('reviews', { sessionId });

            // Calculate average rating
            const avgRating = await this.calculateSessionAverageRating(sessionId);

            return {
                reviews: reviews.map(r => new Review(r).toDTO()),
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                },
                averageRating: avgRating
            };
        } catch (error) {
            console.error('Error getting session reviews:', error);
            throw error;
        }
    }

    // Get reviews by student
    async getStudentReviews(studentId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            
            const reviews = await this.db.findMany('reviews', 
                { studentId }, 
                { orderBy: 'createdAt DESC', limit, offset }
            );

            const totalCount = await this.db.count('reviews', { studentId });

            return {
                reviews: reviews.map(r => new Review(r).toDTO()),
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            };
        } catch (error) {
            console.error('Error getting student reviews:', error);
            throw error;
        }
    }

    // Calculate average rating for a session
    async calculateSessionAverageRating(sessionId) {
        try {
            const reviews = await this.db.findMany('reviews', { sessionId });
            
            if (reviews.length === 0) {
                return 0;
            }

            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            return Math.round((totalRating / reviews.length) * 10) / 10; // Round to 1 decimal
        } catch (error) {
            console.error('Error calculating average rating:', error);
            return 0;
        }
    }

    // Delete a review
    async deleteReview(reviewId, studentId) {
        try {
            // Verify ownership
            const review = await this.db.findById('reviews', reviewId);
            if (!review) {
                throw new Error('Review not found');
            }

            if (review.studentId !== studentId) {
                throw new Error('Unauthorized: Cannot delete another student\'s review');
            }

            await this.db.delete('reviews', reviewId);
            return { success: true, message: 'Review deleted successfully' };
        } catch (error) {
            console.error('Error deleting review:', error);
            throw error;
        }
    }

    // Get review statistics
    async getReviewStats(sessionId) {
        try {
            const reviews = await this.db.findMany('reviews', { sessionId });
            
            const stats = {
                totalReviews: reviews.length,
                averageRating: await this.calculateSessionAverageRating(sessionId),
                ratingDistribution: {
                    5: reviews.filter(r => r.rating === 5).length,
                    4: reviews.filter(r => r.rating === 4).length,
                    3: reviews.filter(r => r.rating === 3).length,
                    2: reviews.filter(r => r.rating === 2).length,
                    1: reviews.filter(r => r.rating === 1).length
                }
            };

            return stats;
        } catch (error) {
            console.error('Error getting review stats:', error);
            throw error;
        }
    }
}

module.exports = ReviewService;