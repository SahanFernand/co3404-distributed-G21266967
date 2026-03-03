-- CO3404 Distributed Systems - MySQL Database Export
-- Use this to restore the database

CREATE DATABASE IF NOT EXISTS jokedb;
USE jokedb;

-- Types table
CREATE TABLE IF NOT EXISTS types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jokes table with foreign key relationship
CREATE TABLE IF NOT EXISTS jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setup TEXT NOT NULL,
    punchline TEXT NOT NULL,
    type_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES types(id)
);

-- Insert default types
INSERT INTO types (name) VALUES 
    ('general'),
    ('programming'),
    ('dad'),
    ('knock-knock'),
    ('pun');

-- Insert sample jokes
INSERT INTO jokes (setup, punchline, type_id) VALUES
    ('Why do programmers prefer dark mode?', 'Because light attracts bugs!', 2),
    ('Why did the developer go broke?', 'Because he used up all his cache!', 2),
    ('What do you call a fake noodle?', 'An impasta!', 3),
    ('Why dont scientists trust atoms?', 'Because they make up everything!', 1),
    ('What do you call a bear with no teeth?', 'A gummy bear!', 5),
    ('Knock knock. Whos there? Boo. Boo who?', 'Dont cry, its just a joke!', 4);
