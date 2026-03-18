/**
 * Progress Model
 * Represents student learning progress for skills
 */

class Progress {
    constructor(data) {
        this.id = data.id || null;
        this.studentId = data.studentId;
        this.skillName = data.skillName;
        this.completedSessions = data.completedSessions || 0;
        this.totalSessions = data.totalSessions || 1;
        this.progressPercentage = this.calculatePercentage();
        this.lastUpdated = data.lastUpdated || new Date().toISOString();
        this.level = this.calculateLevel();
    }

    // Calculate progress percentage
    calculatePercentage() {
        if (this.totalSessions === 0) return 0;
        return Math.round((this.completedSessions / this.totalSessions) * 100);
    }

    // Calculate skill level based on progress
    calculateLevel() {
        const percentage = this.calculatePercentage();
        if (percentage >= 80) return 'Advanced';
        if (percentage >= 50) return 'Intermediate';
        return 'Beginner';
    }

    // Validation
    static validate(data) {
        const errors = [];

        if (!data.studentId) {
            errors.push('Student ID is required');
        }

        if (!data.skillName || data.skillName.trim().length === 0) {
            errors.push('Skill name is required');
        }

        if (data.completedSessions < 0) {
            errors.push('Completed sessions cannot be negative');
        }

        if (data.totalSessions < 1) {
            errors.push('Total sessions must be at least 1');
        }

        if (data.completedSessions > data.totalSessions) {
            errors.push('Completed sessions cannot exceed total sessions');
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
            skillName: this.skillName,
            completedSessions: this.completedSessions,
            totalSessions: this.totalSessions,
            progressPercentage: this.progressPercentage,
            level: this.level,
            lastUpdated: this.lastUpdated
        };
    }

    // Update progress
    updateProgress(completedSessions, totalSessions = null) {
        this.completedSessions = completedSessions;
        if (totalSessions !== null) {
            this.totalSessions = totalSessions;
        }
        this.progressPercentage = this.calculatePercentage();
        this.level = this.calculateLevel();
        this.lastUpdated = new Date().toISOString();
    }
}

module.exports = Progress;