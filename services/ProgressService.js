/**
 * Progress Service
 * Business logic for progress tracking operations
 */

const Progress = require('../models/Progress');
const DatabaseService = require('./DatabaseService');

class ProgressService {
    constructor() {
        this.db = new DatabaseService();
    }

    // Create or update progress
    async createOrUpdateProgress(progressData) {
        try {
            // Validate input
            const validation = Progress.validate(progressData);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if progress already exists
            const existingProgress = await this.db.findOne('progress', {
                studentId: progressData.studentId,
                skillName: progressData.skillName
            });

            const progress = new Progress(progressData);

            if (existingProgress) {
                // Update existing progress
                progress.id = existingProgress.id;
                await this.db.update('progress', existingProgress.id, {
                    completedSessions: progress.completedSessions,
                    totalSessions: progress.totalSessions,
                    progressPercentage: progress.progressPercentage,
                    lastUpdated: progress.lastUpdated
                });
            } else {
                // Create new progress
                const progressId = await this.db.create('progress', {
                    studentId: progress.studentId,
                    skillName: progress.skillName,
                    completedSessions: progress.completedSessions,
                    totalSessions: progress.totalSessions,
                    progressPercentage: progress.progressPercentage,
                    lastUpdated: progress.lastUpdated
                });
                progress.id = progressId;
            }

            return progress.toDTO();
        } catch (error) {
            console.error('Error creating/updating progress:', error);
            throw error;
        }
    }

    // Get all progress for a student
    async getStudentProgress(studentId) {
        try {
            const progressRecords = await this.db.findMany('progress', 
                { studentId }, 
                { orderBy: 'lastUpdated DESC' }
            );

            const progressList = progressRecords.map(p => new Progress(p).toDTO());

            // Calculate overall statistics
            const stats = this.calculateOverallStats(progressList);

            return {
                progress: progressList,
                stats
            };
        } catch (error) {
            console.error('Error getting student progress:', error);
            throw error;
        }
    }

    // Get specific skill progress
    async getSkillProgress(studentId, skillName) {
        try {
            const progressRecord = await this.db.findOne('progress', {
                studentId,
                skillName
            });

            if (!progressRecord) {
                // Return default progress if not found
                return new Progress({
                    studentId,
                    skillName,
                    completedSessions: 0,
                    totalSessions: 1
                }).toDTO();
            }

            return new Progress(progressRecord).toDTO();
        } catch (error) {
            console.error('Error getting skill progress:', error);
            throw error;
        }
    }

    // Update progress after session completion
    async updateProgressAfterSession(studentId, skillName, sessionCompleted = true) {
        try {
            let progressRecord = await this.db.findOne('progress', {
                studentId,
                skillName
            });

            if (!progressRecord) {
                // Create initial progress
                progressRecord = {
                    studentId,
                    skillName,
                    completedSessions: sessionCompleted ? 1 : 0,
                    totalSessions: 1
                };
            } else {
                // Update existing progress
                if (sessionCompleted) {
                    progressRecord.completedSessions += 1;
                }
                // Optionally increase total sessions if needed
                if (progressRecord.completedSessions > progressRecord.totalSessions) {
                    progressRecord.totalSessions = progressRecord.completedSessions;
                }
            }

            return await this.createOrUpdateProgress(progressRecord);
        } catch (error) {
            console.error('Error updating progress after session:', error);
            throw error;
        }
    }

    // Calculate overall statistics
    calculateOverallStats(progressList) {
        if (progressList.length === 0) {
            return {
                totalSkills: 0,
                averageProgress: 0,
                completedSkills: 0,
                skillLevels: {
                    Beginner: 0,
                    Intermediate: 0,
                    Advanced: 0
                }
            };
        }

        const totalProgress = progressList.reduce((sum, p) => sum + p.progressPercentage, 0);
        const averageProgress = Math.round(totalProgress / progressList.length);
        const completedSkills = progressList.filter(p => p.progressPercentage === 100).length;

        const skillLevels = {
            Beginner: progressList.filter(p => p.level === 'Beginner').length,
            Intermediate: progressList.filter(p => p.level === 'Intermediate').length,
            Advanced: progressList.filter(p => p.level === 'Advanced').length
        };

        return {
            totalSkills: progressList.length,
            averageProgress,
            completedSkills,
            skillLevels
        };
    }

    // Get progress dashboard data
    async getProgressDashboard(studentId) {
        try {
            const { progress, stats } = await this.getStudentProgress(studentId);

            // Get recent activity (last 5 updated skills)
            const recentActivity = progress
                .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
                .slice(0, 5);

            // Get skills by level
            const skillsByLevel = {
                Beginner: progress.filter(p => p.level === 'Beginner'),
                Intermediate: progress.filter(p => p.level === 'Intermediate'),
                Advanced: progress.filter(p => p.level === 'Advanced')
            };

            return {
                overview: stats,
                recentActivity,
                skillsByLevel,
                allProgress: progress
            };
        } catch (error) {
            console.error('Error getting progress dashboard:', error);
            throw error;
        }
    }

    // Delete progress record
    async deleteProgress(progressId, studentId) {
        try {
            // Verify ownership
            const progress = await this.db.findById('progress', progressId);
            if (!progress) {
                throw new Error('Progress record not found');
            }

            if (progress.studentId !== studentId) {
                throw new Error('Unauthorized: Cannot delete another student\'s progress');
            }

            await this.db.delete('progress', progressId);
            return { success: true, message: 'Progress deleted successfully' };
        } catch (error) {
            console.error('Error deleting progress:', error);
            throw error;
        }
    }
}

module.exports = ProgressService;