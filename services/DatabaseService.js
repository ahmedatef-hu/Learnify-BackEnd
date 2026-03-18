/**
 * Database Service
 * Simulates database operations using localStorage/file system
 * In production, replace with actual database (PostgreSQL, MongoDB, etc.)
 */

const fs = require('fs').promises;
const path = require('path');

class DatabaseService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.ensureDataDirectory();
    }

    // Ensure data directory exists
    async ensureDataDirectory() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    // Get file path for table
    getFilePath(tableName) {
        return path.join(this.dataDir, `${tableName}.json`);
    }

    // Read data from file
    async readData(tableName) {
        try {
            const filePath = this.getFilePath(tableName);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Return empty array if file doesn't exist
            return [];
        }
    }

    // Write data to file
    async writeData(tableName, data) {
        try {
            const filePath = this.getFilePath(tableName);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error writing to ${tableName}:`, error);
            throw error;
        }
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Create record
    async create(tableName, record) {
        try {
            const data = await this.readData(tableName);
            const id = this.generateId();
            const newRecord = { id, ...record };
            data.push(newRecord);
            await this.writeData(tableName, data);
            return id;
        } catch (error) {
            console.error(`Error creating record in ${tableName}:`, error);
            throw error;
        }
    }

    // Find by ID
    async findById(tableName, id) {
        try {
            const data = await this.readData(tableName);
            return data.find(record => record.id === id) || null;
        } catch (error) {
            console.error(`Error finding record by ID in ${tableName}:`, error);
            throw error;
        }
    }

    // Find one record by criteria
    async findOne(tableName, criteria) {
        try {
            const data = await this.readData(tableName);
            return data.find(record => {
                return Object.keys(criteria).every(key => record[key] === criteria[key]);
            }) || null;
        } catch (error) {
            console.error(`Error finding record in ${tableName}:`, error);
            throw error;
        }
    }

    // Find many records by criteria
    async findMany(tableName, criteria = {}, options = {}) {
        try {
            let data = await this.readData(tableName);

            // Filter by criteria
            if (Object.keys(criteria).length > 0) {
                data = data.filter(record => {
                    return Object.keys(criteria).every(key => record[key] === criteria[key]);
                });
            }

            // Sort
            if (options.orderBy) {
                const [field, direction] = options.orderBy.split(' ');
                data.sort((a, b) => {
                    let aVal = a[field];
                    let bVal = b[field];

                    // Handle date strings
                    if (field.includes('At') || field.includes('Updated')) {
                        aVal = new Date(aVal);
                        bVal = new Date(bVal);
                    }

                    if (direction === 'DESC') {
                        return bVal > aVal ? 1 : -1;
                    }
                    return aVal > bVal ? 1 : -1;
                });
            }

            // Pagination
            if (options.limit) {
                const offset = options.offset || 0;
                data = data.slice(offset, offset + options.limit);
            }

            return data;
        } catch (error) {
            console.error(`Error finding records in ${tableName}:`, error);
            throw error;
        }
    }

    // Count records
    async count(tableName, criteria = {}) {
        try {
            let data = await this.readData(tableName);

            if (Object.keys(criteria).length > 0) {
                data = data.filter(record => {
                    return Object.keys(criteria).every(key => record[key] === criteria[key]);
                });
            }

            return data.length;
        } catch (error) {
            console.error(`Error counting records in ${tableName}:`, error);
            throw error;
        }
    }

    // Update record
    async update(tableName, id, updates) {
        try {
            const data = await this.readData(tableName);
            const index = data.findIndex(record => record.id === id);

            if (index === -1) {
                throw new Error('Record not found');
            }

            data[index] = { ...data[index], ...updates };
            await this.writeData(tableName, data);
            return data[index];
        } catch (error) {
            console.error(`Error updating record in ${tableName}:`, error);
            throw error;
        }
    }

    // Delete record
    async delete(tableName, id) {
        try {
            const data = await this.readData(tableName);
            const filteredData = data.filter(record => record.id !== id);

            if (data.length === filteredData.length) {
                throw new Error('Record not found');
            }

            await this.writeData(tableName, filteredData);
            return true;
        } catch (error) {
            console.error(`Error deleting record in ${tableName}:`, error);
            throw error;
        }
    }

    // Clear all data (for testing)
    async clearTable(tableName) {
        try {
            await this.writeData(tableName, []);
        } catch (error) {
            console.error(`Error clearing table ${tableName}:`, error);
            throw error;
        }
    }
}

module.exports = DatabaseService;