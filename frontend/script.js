// Copper Shores Frontend - Main Script
// This script demonstrates frontend-backend connection and handles DOM interactions

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Fetch campaign status from the backend when page loads
 * This demonstrates the frontend-backend connection
 */
function loadCampaignStatus() {
    const apiInfoDiv = document.getElementById('api-info');
    
    // Fetch data from the Gold API endpoint (as an example)
    fetch(`${API_BASE_URL}/gold`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Display the API response on the page
            apiInfoDiv.innerHTML = `
                <p class="success">✓ Backend Connected</p>
                <p class="message"><strong>Message:</strong> ${data.message}</p>
                <p class="message"><strong>Status:</strong> ${data.status}</p>
                <p class="message"><em>API endpoint: GET /api/gold</em></p>
            `;
        })
        .catch(error => {
            console.error('Error fetching campaign data:', error);
            apiInfoDiv.innerHTML = `
                <p style="color: #ff6b6b;"><strong>⚠️ Connection Error</strong></p>
                <p style="color: #ff6b6b;">Unable to reach backend server at ${API_BASE_URL}</p>
                <p style="color: #ffd93d;">Make sure the Node.js server is running on port 3000</p>
            `;
        });
}

/**
 * Setup refresh button to reload campaign status
 */
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCampaignStatus);
    }
}

/**
 * Update active navigation link based on current page
 */
function updateActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        link.classList.remove('active');
        
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

/**
 * Initialize the page when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    updateActiveNav();
    loadCampaignStatus();
    setupRefreshButton();
});
