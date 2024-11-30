import puppeteer from 'puppeteer';
import { config } from 'dotenv';
import { 
    randomDelay, 
    simulateHumanScrolling, 
    simulateMouseMovement,
    generateRandomUserAgent 
} from './utils.js';
import { savePost } from './db/index.js';
import fs from 'fs';

config();

const INSTAGRAM_LOGIN = 'https://www.instagram.com/accounts/login/';
const TARGET_PROFILE = 'https://www.instagram.com/faire_wholesale/';
const COOKIES_PATH = './cookies.json';

async function initBrowser() {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-size=1366,768',
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(generateRandomUserAgent());

    return { browser, page };
}

async function loginToInstagram(page) {
    try {
        if (fs.existsSync(COOKIES_PATH)) {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            await page.setCookie(...cookies);
            console.log('Session cookies loaded');
            return true;
        }

        await page.goto(INSTAGRAM_LOGIN);
        await randomDelay(2000, 4000);

        // Fill login form
        await page.type('input[name="username"]', process.env.INSTAGRAM_USERNAME, { delay: 50 });
        await randomDelay(500, 1000);
        await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD, { delay: 50 });
        await randomDelay(500, 1000);

        // Click login button
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        // Save cookies
        const cookies = await page.cookies();
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
        console.log('Login successful');
        return true;
    } catch (error) {
        console.error('Login failed:', error);
        return false;
    }
}

async function extractPostData(page, postUrl) {
    try {
        await page.goto(postUrl, { waitUntil: 'networkidle0' });
        await randomDelay(2000, 4000);

        const data = await page.evaluate(() => {
            const extractEmails = text => {
                const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                return text.match(emailRegex) || [];
            };

            const extractWebsites = text => {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const urls = text.match(urlRegex) || [];
                return urls.filter(url => {
                    const socialMediaDomains = [
                        'instagram.com', 'facebook.com', 'twitter.com', 
                        'tiktok.com', 'youtube.com', 'linkedin.com',
                        'threads.net', 'snapchat.com', 'pinterest.com'
                    ];
                    return !socialMediaDomains.some(domain => url.includes(domain));
                });
            };

            const isEuropeanBrand = (text, website) => {
                // European country/region keywords
                const europeanKeywords = [
                    'europe', 'european', 'eu', 'uk', 'britain', 'france', 'germany', 
                    'italy', 'spain', 'netherlands', 'belgium', 'sweden', 'denmark',
                    'norway', 'finland', 'ireland', 'austria', 'switzerland'
                ];

                // European TLDs
                const europeanTLDs = [
                    '.eu', '.de', '.fr', '.uk', '.it', '.es', '.nl', '.be', 
                    '.se', '.dk', '.no', '.fi', '.ie', '.at', '.ch'
                ];

                // European currencies
                const europeanCurrencies = ['€', '£', 'eur', 'euro', 'gbp', 'pound'];

                const lowerText = text.toLowerCase();
                
                // Check for European keywords in text
                const hasEuropeanKeywords = europeanKeywords.some(keyword => 
                    lowerText.includes(keyword.toLowerCase())
                );

                // Check for European TLDs in website
                const hasEuropeanTLD = website && europeanTLDs.some(tld => 
                    website.toLowerCase().endsWith(tld)
                );

                // Check for European currency symbols
                const hasEuropeanCurrency = europeanCurrencies.some(currency => 
                    lowerText.includes(currency.toLowerCase())
                );

                return hasEuropeanKeywords || hasEuropeanTLD || hasEuropeanCurrency;
            };

            const extractHandles = text => {
                // Match both @mentions and profile links
                const handleRegex = /@([A-Za-z0-9._]+)/g;
                const matches = text.match(handleRegex) || [];
                return matches.map(handle => handle.replace('@', ''));
            };

            // Get all text content from the post
            const article = document.querySelector('article');
            const postContent = article?.textContent || '';
            const postCaption = article?.querySelector('h1')?.textContent || '';
            const comments = Array.from(article?.querySelectorAll('ul li') || [])
                .map(li => li.textContent)
                .join(' ');

            // Combine all text content for thorough extraction
            const allContent = `${postContent} ${postCaption} ${comments}`;
            
            // Get handles from the post
            const handles = extractHandles(allContent);
            const mainHandle = handles.length > 0 ? handles[0] : '';
            const website = extractWebsites(allContent)[0] || '';
            
            // Check if it's a European brand
            const isEuropean = isEuropeanBrand(allContent, website);
            
            return {
                handle: mainHandle,
                email: extractEmails(allContent)[0] || '',
                website: website,
                postUrl: window.location.href,
                mentionedHandles: handles.join(', '),
                isEuropean: isEuropean,
                marketplace: 'Faire'
            };
        });

        // Save data only if it's a European brand
        if (data && data.isEuropean && (data.email || data.website || data.handle || data.mentionedHandles)) {
            try {
                const saved = await savePost(data);
                if (saved) {
                    console.log('Post data saved successfully:', {
                        handle: data.handle,
                        mentionedHandles: data.mentionedHandles,
                        postUrl: data.postUrl,
                        marketplace: data.marketplace
                    });
                } else {
                    console.error('Failed to save post data');
                }
            } catch (error) {
                console.error('Error while saving post:', error);
            }
        } else {
            console.log('No relevant data found to save or not a European brand');
        }

        console.log('Extracted Data:', data);

        // Simulate human-like post closing behavior
        await randomDelay(1500, 3000);
        
        if (Math.random() > 0.5) {
            const closeButton = await page.$('button[aria-label="Close"], svg[aria-label="Close"]');
            if (closeButton) {
                await closeButton.click();
            } else {
                await page.goBack();
            }
        } else {
            await page.goBack();
        }
        
        await randomDelay(1000, 2000);
        return data;
    } catch (error) {
        console.error('Error extracting post data:', error);
        await page.goBack();
        return null;
    }
}

async function collectRandomPosts(maxPosts = 10) {
    const { browser, page } = await initBrowser();
    let collectedPosts = 0;
    let processedPosts = new Set();

    try {
        const loginSuccess = await loginToInstagram(page);
        if (!loginSuccess) {
            throw new Error('Failed to login to Instagram');
        }

        // Navigate to profile
        console.log('Navigating to profile...');
        await page.goto(TARGET_PROFILE);
        await randomDelay(3000, 5000);

        while (collectedPosts < maxPosts) {
            console.log('Waiting for content to load...');
            await randomDelay(2000, 3000);

            // Simulate human scrolling
            console.log('Scrolling to load content...');
            await simulateHumanScrolling(page);
            await simulateMouseMovement(page);

            // Get all post links
            const postLinks = await page.evaluate(() => {
                const links = document.querySelectorAll('a');
                return Array.from(links)
                    .filter(link => link.href.includes('/p/'))
                    .map(link => link.href);
            });

            console.log(`Found ${postLinks.length} posts`);

            // Randomly shuffle the posts
            const shuffledPosts = postLinks
                .filter(url => !processedPosts.has(url))
                .sort(() => Math.random() - 0.5);

            // Process random posts
            for (const postUrl of shuffledPosts) {
                if (collectedPosts >= maxPosts) break;
                if (processedPosts.has(postUrl)) continue;

                processedPosts.add(postUrl);
                console.log(`Post found: ${new URL(postUrl).pathname}`);

                try {
                    console.log('Extracting data...');
                    const postData = await extractPostData(page, postUrl);
                    if (postData && postData.isEuropean && (postData.email || postData.website || postData.handle || postData.mentionedHandles)) {
                        collectedPosts++;
                        console.log(`Collected ${collectedPosts}/${maxPosts} posts`);
                    }

                    // Random delay between posts
                    await randomDelay(2000, 4000);
                    await simulateMouseMovement(page);
                } catch (error) {
                    console.error('Error processing post:', error);
                }
            }

            // If we haven't found enough posts, scroll more
            if (collectedPosts < maxPosts) {
                await simulateHumanScrolling(page);
                await randomDelay(3000, 5000);
            }
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
}

// Start scraping
collectRandomPosts(10).catch(console.error);
