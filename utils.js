// Utility functions for human-like browsing

export function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export const POPULAR_HASHTAGS = [
    'entrepreneur', 'business', 'startup', 'smallbusiness', 
    'marketing', 'digitalmarketing', 'ecommerce', 'branding',
    'entrepreneurship', 'success', 'motivation', 'businessowner',
    'innovation', 'leadership', 'startuplife', 'businessgrowth'
];

export function getRandomHashtag() {
    return POPULAR_HASHTAGS[Math.floor(Math.random() * POPULAR_HASHTAGS.length)];
}

export async function simulateHumanScrolling(page) {
    const scrolls = randomInt(3, 7);
    for (let i = 0; i < scrolls; i++) {
        const scrollAmount = randomInt(300, 800);
        await page.evaluate((amount) => {
            window.scrollBy(0, amount);
        }, scrollAmount);
        await randomDelay(1000, 3000);
    }
}

export async function simulateMouseMovement(page) {
    await page.evaluate(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        document.dispatchEvent(event);
    });
    await randomDelay(500, 1500);
}

export function generateRandomUserAgent() {
    const versions = ['537.36', '537.35', '537.34'];
    const osVersions = ['10.0', '11.0'];
    const version = versions[Math.floor(Math.random() * versions.length)];
    const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)];
    return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/${version} (KHTML, like Gecko) Chrome/119.0.0.0 Safari/${version}`;
}

export async function closePost(page) {
    try {
        // Try clicking the close button if it exists
        const closeButton = await page.$('button[aria-label="Close"], svg[aria-label="Close"]');
        if (closeButton) {
            await closeButton.click();
            return true;
        }
        
        // If no close button, try pressing Escape key
        await page.keyboard.press('Escape');
        return true;
    } catch (error) {
        console.error('Error closing post:', error);
        return false;
    }
}

export async function navigateBack(page) {
    try {
        await page.goBack();
        return true;
    } catch (error) {
        console.error('Error navigating back:', error);
        return false;
    }
}

export async function exitPost(page) {
    // Randomly choose between closing the post or going back
    const shouldClose = Math.random() > 0.5;
    
    if (shouldClose) {
        const closed = await closePost(page);
        if (!closed) {
            await navigateBack(page);
        }
    } else {
        const wentBack = await navigateBack(page);
        if (!wentBack) {
            await closePost(page);
        }
    }
    
    // Wait for navigation to complete
    await randomDelay(1000, 2000);
}
