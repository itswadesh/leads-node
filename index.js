import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD?.replace(/"/g, '');
const COOKIES_FILE = './cookies.json';

// Function to generate random delay between min and max seconds
const randomDelay = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
};

// Function to simulate human-like typing
async function typeWithDelay(page, selector, text) {
    const element = await page.$(selector);
    for (let char of text) {
        await element.type(char, { delay: Math.random() * 100 + 50 });
        await setTimeout(Math.random() * 50);
    }
}

async function saveCookies(page) {
    const cookies = await page.cookies();
    await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log('Session cookies saved');
}

async function loadCookies(page) {
    try {
        const cookiesString = await fs.readFile(COOKIES_FILE);
        const cookies = JSON.parse(cookiesString);
        if (cookies.length) {
            await page.setCookie(...cookies);
            console.log('Session cookies loaded');
            return true;
        }
    } catch (error) {
        console.log('No saved session found');
    }
    return false;
}

async function isLoggedIn(page) {
    try {
        // Check if we can find elements that are only present when logged in
        await page.waitForSelector('svg[aria-label="Home"]', { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

async function login(page) {
    console.log('Logging in...');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle0' });
    await setTimeout(randomDelay(2, 4));

    await typeWithDelay(page, 'input[name="username"]', INSTAGRAM_USERNAME);
    await setTimeout(randomDelay(1, 2));
    await typeWithDelay(page, 'input[name="password"]', INSTAGRAM_PASSWORD);
    await setTimeout(randomDelay(0.5, 1.5));

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);
    await setTimeout(randomDelay(4, 6));

    // Save cookies after successful login
    await saveCookies(page);
}

async function scrapeInstagramPost() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Try to load saved session
        const hasCookies = await loadCookies(page);
        if (hasCookies) {
            // Go to Instagram home to verify login
            await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0' });
            const loggedIn = await isLoggedIn(page);
            if (!loggedIn) {
                await login(page);
            }
        } else {
            await login(page);
        }

        console.log('Navigating to profile...');
        await page.goto('https://www.instagram.com/faire_wholesale/?hl=en', { waitUntil: 'networkidle0' });
        await setTimeout(randomDelay(3, 5));

        console.log('Waiting for content to load...');
        
        // Scroll to ensure content is loaded
        console.log('Scrolling to load content...');
        await page.evaluate(() => {
            window.scrollBy(0, 1000);
            return new Promise((resolve) => setTimeout(resolve, 1000));
        });
        await setTimeout(randomDelay(2, 3));

        // Find posts using href pattern
        console.log('Looking for posts...');
        const posts = await page.evaluate(() => {
            const postLinks = Array.from(document.querySelectorAll('a[href*="/p/"]'))
                .filter(a => {
                    // Match pattern /faire_wholesale/p/XXXXXXXX/ where X is any character
                    const pattern = /\/faire_wholesale\/p\/[A-Za-z0-9_-]+\//;
                    return pattern.test(a.getAttribute('href'));
                })
                .map(a => ({
                    href: a.getAttribute('href'),
                    position: a.getBoundingClientRect()
                }));
            return postLinks;
        });

        console.log(`Found ${posts.length} posts`);

        if (posts.length > 0) {
            const firstPost = posts[0];
            console.log('Post found:', firstPost.href);
            
            // Click the post
            await page.evaluate((postHref) => {
                const link = document.querySelector(`a[href="${postHref}"]`);
                if (link) {
                    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, firstPost.href);
            
            await setTimeout(randomDelay(1, 2));

            try {
                // Click using the href directly
                await Promise.all([
                    page.waitForSelector('article[role="presentation"]', { timeout: 8000 }),
                    page.click(`a[href="${firstPost.href}"]`)
                ]);
                
                await setTimeout(randomDelay(2, 4));

                console.log('Extracting data...');
                const postData = await page.evaluate(() => {
                    const data = {
                        email: '',
                        handle: '',
                        website: ''
                    };

                    const postText = document.querySelector('article')?.textContent || '';
                    const emailMatch = postText.match(/[\w.-]+@[\w.-]+\.\w+/);
                    if (emailMatch) {
                        data.email = emailMatch[0];
                    }

                    const handleElement = document.querySelector('article header a');
                    if (handleElement) {
                        data.handle = handleElement.textContent;
                    }

                    const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
                    const websiteLink = links.find(link => 
                        link.startsWith('http') && 
                        !link.includes('instagram.com') && 
                        !link.includes('facebook.com')
                    );
                    if (websiteLink) {
                        data.website = websiteLink;
                    }

                    return data;
                });

                console.log('Extracted Data:', postData);
            } catch (error) {
                console.error('Error occurred:', error);
            }
        } else {
            console.log('No posts found');
        }

    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        await setTimeout(randomDelay(1, 2));
        await browser.close();
    }
}

scrapeInstagramPost();
