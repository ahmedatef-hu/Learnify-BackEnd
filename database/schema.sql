-- Learnify Database Schema
-- Rating and Feedback System + Progress Tracking System

-- ============================================
-- USERS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- SKILL EXCHANGE SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    session_date TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_sessions_teacher (teacher_id),
    INDEX idx_sessions_student (student_id),
    INDEX idx_sessions_skill (skill_name),
    INDEX idx_sessions_date (session_date)
);

-- ============================================
-- REVIEWS TABLE (Rating and Feedback System)
-- ============================================
CREATE TABLE reviews (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Ensure one review per student per session
    UNIQUE KEY unique_student_session (student_id, session_id),
    
    INDEX idx_reviews_student (student_id),
    INDEX idx_reviews_session (session_id),
    INDEX idx_reviews_rating (rating),
    INDEX idx_reviews_created (created_at)
);

-- ============================================
-- PROGRESS TABLE (Progress Tracking System)
-- ============================================
CREATE TABLE progress (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    completed_sessions INT DEFAULT 0 CHECK (completed_sessions >= 0),
    total_sessions INT DEFAULT 1 CHECK (total_sessions >= 1),
    progress_percentage INT GENERATED ALWAYS AS (
        CASE 
            WHEN total_sessions = 0 THEN 0
            ELSE ROUND((completed_sessions * 100.0) / total_sessions)
        END
    ) STORED,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Ensure one progress record per student per skill
    UNIQUE KEY unique_student_skill (student_id, skill_name),
    
    -- Ensure completed sessions don't exceed total sessions
    CHECK (completed_sessions <= total_sessions),
    
    INDEX idx_progress_student (student_id),
    INDEX idx_progress_skill (skill_name),
    INDEX idx_progress_percentage (progress_percentage),
    INDEX idx_progress_updated (last_updated)
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Session Reviews with User Details
CREATE VIEW session_reviews_view AS
SELECT 
    r.id,
    r.session_id,
    r.student_id,
    u.name as student_name,
    u.email as student_email,
    r.rating,
    r.comment,
    r.created_at,
    s.title as session_title,
    s.skill_name
FROM reviews r
JOIN users u ON r.student_id = u.id
JOIN sessions s ON r.session_id = s.id;

-- View: Session Statistics
CREATE VIEW session_stats_view AS
SELECT 
    s.id as session_id,
    s.title,
    s.skill_name,
    COUNT(r.id) as total_reviews,
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count
FROM sessions s
LEFT JOIN reviews r ON s.id = r.session_id
GROUP BY s.id, s.title, s.skill_name;

-- View: Student Progress with Levels
CREATE VIEW student_progress_view AS
SELECT 
    p.id,
    p.student_id,
    u.name as student_name,
    p.skill_name,
    p.completed_sessions,
    p.total_sessions,
    p.progress_percentage,
    CASE 
        WHEN p.progress_percentage >= 80 THEN 'Advanced'
        WHEN p.progress_percentage >= 50 THEN 'Intermediate'
        ELSE 'Beginner'
    END as skill_level,
    p.last_updated,
    p.created_at
FROM progress p
JOIN users u ON p.student_id = u.id;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Additional composite indexes for common queries
CREATE INDEX idx_reviews_session_rating ON reviews(session_id, rating);
CREATE INDEX idx_reviews_student_created ON reviews(student_id, created_at);
CREATE INDEX idx_progress_student_updated ON progress(student_id, last_updated);

-- ============================================
-- TRIGGERS FOR DATA INTEGRITY
-- ============================================

-- Trigger: Update session status when reviewed
DELIMITER //
CREATE TRIGGER update_session_status_after_review
    AFTER INSERT ON reviews
    FOR EACH ROW
BEGIN
    UPDATE sessions 
    SET status = 'completed' 
    WHERE id = NEW.session_id AND status = 'in_progress';
END//
DELIMITER ;

-- Trigger: Auto-update progress when session is completed
DELIMITER //
CREATE TRIGGER auto_update_progress_on_session_complete
    AFTER UPDATE ON sessions
    FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO progress (
            id,
            student_id, 
            skill_name, 
            completed_sessions, 
            total_sessions
        )
        VALUES (
            CONCAT('prog_', UNIX_TIMESTAMP(), '_', FLOOR(RAND() * 1000)),
            NEW.student_id,
            NEW.skill_name,
            1,
            1
        )
        ON DUPLICATE KEY UPDATE
            completed_sessions = completed_sessions + 1,
            total_sessions = GREATEST(total_sessions, completed_sessions + 1);
    END IF;
END//
DELIMITER ;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample users
INSERT IGNORE INTO users (id, name, email, phone) VALUES
('user_001', 'Ahmed Hassan', 'ahmed.hassan@email.com', '+20 100 123 4567'),
('user_002', 'Sara Mohamed', 'sara.mohamed@email.com', '+20 101 234 5678'),
('user_003', 'Omar Ali', 'omar.ali@email.com', '+20 102 345 6789'),
('user_004', 'Nour Ibrahim', 'nour.ibrahim@email.com', '+20 103 456 7890');

-- Insert sample sessions
INSERT IGNORE INTO sessions (id, title, skill_name, teacher_id, student_id, session_date, duration_minutes, status) VALUES
('session_001', 'React Hooks Deep Dive', 'React', 'user_001', 'user_002', '2024-01-15 14:00:00', 120, 'completed'),
('session_002', 'Python Data Analysis', 'Python', 'user_002', 'user_003', '2024-01-16 10:00:00', 90, 'completed'),
('session_003', 'UI/UX Design Principles', 'Design', 'user_003', 'user_001', '2024-01-17 16:00:00', 60, 'in_progress'),
('session_004', 'Node.js Backend Development', 'Node.js', 'user_004', 'user_002', '2024-01-18 13:00:00', 150, 'scheduled');

-- Insert sample reviews
INSERT IGNORE INTO reviews (id, student_id, session_id, rating, comment) VALUES
('review_001', 'user_002', 'session_001', 5, 'Excellent session! Ahmed explained React hooks very clearly with practical examples.'),
('review_002', 'user_003', 'session_002', 4, 'Great introduction to data analysis. Sara is very knowledgeable and patient.'),
('review_003', 'user_001', 'session_003', 5, 'Amazing design insights! Omar has great eye for user experience.');

-- Insert sample progress
INSERT IGNORE INTO progress (id, student_id, skill_name, completed_sessions, total_sessions) VALUES
('progress_001', 'user_002', 'React', 3, 5),
('progress_002', 'user_002', 'JavaScript', 8, 10),
('progress_003', 'user_003', 'Python', 5, 8),
('progress_004', 'user_003', 'Data Science', 2, 6),
('progress_005', 'user_001', 'Design', 4, 5),
('progress_006', 'user_001', 'Frontend', 7, 10);

-- ============================================
-- USEFUL QUERIES FOR TESTING
-- ============================================

/*
-- Get all reviews for a session with user details
SELECT * FROM session_reviews_view WHERE session_id = 'session_001';

-- Get session statistics
SELECT * FROM session_stats_view WHERE session_id = 'session_001';

-- Get student progress with levels
SELECT * FROM student_progress_view WHERE student_id = 'user_002';

-- Get average rating for all sessions
SELECT 
    session_id,
    title,
    skill_name,
    total_reviews,
    ROUND(average_rating, 1) as avg_rating
FROM session_stats_view 
WHERE total_reviews > 0
ORDER BY average_rating DESC;

-- Get student progress summary
SELECT 
    student_id,
    student_name,
    COUNT(*) as total_skills,
    AVG(progress_percentage) as avg_progress,
    SUM(CASE WHEN progress_percentage = 100 THEN 1 ELSE 0 END) as completed_skills
FROM student_progress_view 
GROUP BY student_id, student_name;
*/