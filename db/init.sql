-- ============================
-- STUDENTS
-- ============================
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================
-- EVENTS
-- ============================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    event_date TIMESTAMP NOT NULL,
    location VARCHAR(150),
    capacity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    category VARCHAR(30) NOT NULL DEFAULT 'general',
    closed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================
-- REGISTRATIONS
-- ============================
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'registered',
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, event_id)
);

-- ============================
-- SEED DATA (for demo/testing)
-- ============================
INSERT INTO events (title, description, event_date, location, capacity, status)
VALUES
    ('IT Organization General Assembly', 'Mandatory general assembly for all IT org members.', '2026-10-15 13:00:00', 'Main Auditorium', 100, 'open'),
    ('Web Dev Workshop', 'Hands-on workshop on modern web development.', '2026-10-22 09:00:00', 'Computer Lab 3', 40, 'open'),
    ('Capstone Orientation', 'Orientation for capstone project requirements.', '2026-10-29 10:00:00', 'Room 204', 60, 'open')
ON CONFLICT DO NOTHING;