import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { getAllPosts, getPostsByEmailDomain } from './db/index.js';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// Serve static files from public directory
app.use('/*', serveStatic({ root: './public' }));

// API Routes
app.get('/', (c) => {
    return c.redirect('/dashboard');
});

app.get('/api/posts', async (c) => {
    const posts = await getAllPosts();
    return c.json({ success: true, data: posts });
});

app.get('/api/posts/domain/:domain', async (c) => {
    const domain = c.req.param('domain');
    const posts = await getPostsByEmailDomain(domain);
    return c.json({ success: true, data: posts });
});

// Serve the HTML dashboard
app.get('/dashboard', async (c) => {
    return c.html(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Instagram Leads Dashboard</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js"></script>
        </head>
        <body class="bg-gray-100">
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold mb-8">Instagram Leads Dashboard</h1>
                
                <!-- Search and Filter -->
                <div class="mb-6">
                    <input type="text" id="searchInput" 
                           placeholder="Search by email or domain..." 
                           class="w-full p-2 border rounded-lg">
                </div>

                <!-- Data Table -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handle</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Post URL</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody id="tableBody" class="bg-white divide-y divide-gray-200">
                            <!-- Data will be inserted here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <script>
                async function fetchData() {
                    try {
                        const response = await fetch('/api/posts');
                        const { data } = await response.json();
                        displayData(data);
                    } catch (error) {
                        console.error('Error fetching data:', error);
                        Swal.fire({
                            title: 'Error!',
                            text: 'Failed to fetch data',
                            icon: 'error'
                        });
                    }
                }

                function displayData(posts) {
                    const tableBody = document.getElementById('tableBody');
                    tableBody.innerHTML = posts.map(post => \`
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap">\${post.instagram_handle || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">\${post.email || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                \${post.website ? \`<a href="\${post.website}" target="_blank" class="text-blue-600 hover:text-blue-800">\${post.website}</a>\` : '-'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <a href="\${post.post_url}" target="_blank" class="text-blue-600 hover:text-blue-800">View Post</a>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">\${new Date(post.created_at).toLocaleString()}</td>
                        </tr>
                    \`).join('');
                }

                // Search functionality
                document.getElementById('searchInput').addEventListener('input', function(e) {
                    const searchTerm = e.target.value.toLowerCase();
                    const rows = document.querySelectorAll('#tableBody tr');
                    
                    rows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.style.display = text.includes(searchTerm) ? '' : 'none';
                    });
                });

                // Initial load
                fetchData();
            </script>
        </body>
        </html>
    `);
});

// Start the server
const port = process.env.PORT || 3000;
console.log(`Server running at http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch
};
