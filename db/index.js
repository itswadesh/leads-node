import { Database } from "bun:sqlite";

let db;

// Initialize database
export async function initDB() {
    db = new Database("instagram.sqlite", { create: true });
    
    // Create posts table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instagram_handle TEXT,
            email TEXT,
            website TEXT,
            post_url TEXT UNIQUE,
            mentioned_handles TEXT,
            marketplace TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('Database initialized');
}

// Save post data
export async function savePost(data) {
    if (!db) {
        console.error('Database not initialized');
        await initDB();
    }

    // Map old data format to new schema
    const instagramHandle = data.instagramHandle || data.handle;
    const { email, website, mentionedHandles } = data;
    const postUrl = data.postUrl || data.post_url;

    console.log('Saving post data:', { instagramHandle, email, website, postUrl, mentionedHandles });
    
    try {
        const result = db.prepare(`
            INSERT OR REPLACE INTO posts (instagram_handle, email, website, post_url, mentioned_handles, marketplace)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run([instagramHandle, email, website, postUrl, mentionedHandles, 'Faire']);

        console.log('Post saved successfully:', result);
        return true;
    } catch (error) {
        console.error('Error saving post:', error);
        return false;
    }
}

// Get all posts
export async function getAllPosts() {
    if (!db) {
        console.error('Database not initialized');
        await initDB();
    }
    return db.query('SELECT * FROM posts ORDER BY created_at DESC').all();
}

// Get posts by email domain
export async function getPostsByEmailDomain(domain) {
    if (!db) {
        console.error('Database not initialized');
        await initDB();
    }
    return db.query(
        'SELECT * FROM posts WHERE email LIKE ? ORDER BY created_at DESC',
        [`%@${domain}`]
    ).all();
}

// Close database connection
export async function closeDB() {
    if (db) {
        db.close();
    }
}
