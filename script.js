class LogViewer {
    constructor() {
        // DOM Elements
        this.logContent = document.getElementById('logContent');
        this.totalLinesElement = document.getElementById('totalLines');
        this.lastUpdatedElement = document.getElementById('lastUpdated');
        this.statusElement = document.getElementById('status');
        this.errorMessage = document.getElementById('errorMessage');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.autoRefreshCheckbox = document.getElementById('autoRefresh');
        this.startBotBtn = document.getElementById('startBotBtn');
        this.stopBotBtn = document.getElementById('stopBotBtn');
        this.scheduleInterval = document.getElementById('scheduleInterval');
        this.scheduleUnit = document.getElementById('scheduleUnit');
        this.scheduleEnabled = document.getElementById('scheduleEnabled');
        this.scheduleSettings = document.getElementById('scheduleSettings');
        
        // State
        this.autoRefreshInterval = null;
        this.botScheduleInterval = null;
        this.isLoading = false;
        this.isBotRunning = false;
        this.scheduledTask = null;
        
        // Create toast container if it doesn't exist
        this.createToastContainer();
        
        this.initEventListeners();
    }
    
    createToastContainer() {
        // Check if toast container already exists
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '1000';
            document.body.appendChild(toastContainer);
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'toast-close';
        closeBtn.onclick = () => toast.remove();
        toast.appendChild(closeBtn);
        
        // Add to container
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }
    
    initEventListeners() {
        // Log controls
        this.refreshBtn.addEventListener('click', () => this.loadLogs());
        this.clearBtn.addEventListener('click', () => this.clearLogs());
        this.autoRefreshCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
        
        // Bot controls
        this.startBotBtn.addEventListener('click', () => this.startBot());
        this.stopBotBtn.addEventListener('click', () => this.stopBot());
        
        // Schedule controls
        this.scheduleEnabled.addEventListener('change', () => this.handleScheduleToggle());
        this.scheduleInterval.addEventListener('change', () => this.updateScheduleIfEnabled());
        this.scheduleUnit.addEventListener('change', () => this.updateScheduleIfEnabled());
    }
    
    async loadLogs() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        // this.setStatus('Loading', 'info');
        this.hideError();
        
        try {
            const response = await fetch('http://localhost:5000/logs.txt');
            
            if (!response.ok) {
                throw new Error(`Failed to load logs: ${response.status} ${response.statusText}`);
            }
            
            const logText = await response.text();
            this.displayLogs(logText);
            this.updateStats(logText);
            // this.setStatus('Connected', 'success');
            
        } catch (error) {
            console.error('Error loading logs:', error);
            this.showError(`Error loading logs: ${error.message}`);
            // this.setStatus('Error', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    displayLogs(logText) {
        if (!logText.trim()) {
            this.logContent.innerHTML = '<div class="loading">No logs found or logs.txt is empty</div>';
            return;
        }
        
        // Store current scroll position
        const wasScrolledToTop = this.logContent.scrollTop === 0;
        const previousScrollHeight = this.logContent.scrollHeight;
        
        // Split logs into lines, filter out empty lines, and reverse the array to show latest first
        const lines = logText.split('\n').filter(line => line.trim()).reverse();
        const logHtml = lines.map((line, index) => {
            const logClass = this.getLogClass(line);
            const timestamp = this.extractTimestamp(line);
            const content = this.formatLogContent(line);
            
            return `<div class="log-line ${logClass}" data-line="${index + 1}">
                ${timestamp ? `<span class="timestamp">${timestamp}</span>` : ''}
                ${content}
            </div>`;
        }).join('');
        
        // Update content
        this.logContent.innerHTML = logHtml;
        
        // Auto-scroll to top to show latest logs
        this.logContent.scrollTop = 0;
        
        // If user was scrolled to top before refresh, keep them there
        // Otherwise, maintain their relative scroll position
        if (!wasScrolledToTop) {
            const newScrollHeight = this.logContent.scrollHeight;
            const scrollDifference = newScrollHeight - previousScrollHeight;
            if (scrollDifference > 0) {
                this.logContent.scrollTop = scrollDifference;
            }
        }
    }
    
    getLogClass(line) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('failed')) {
            return 'error';
        }
        if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
            return 'warning';
        }
        if (lowerLine.includes('success') || lowerLine.includes('completed') || lowerLine.includes('ok')) {
            return 'success';
        }
        if (lowerLine.includes('info') || lowerLine.includes('debug')) {
            return 'info';
        }
        
        return '';
    }
    
    extractTimestamp(line) {
        // Common timestamp patterns
        const patterns = [
            /(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/,
            /(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/,
            /(\d{2}:\d{2}:\d{2})/,
            /(\[\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\])/
        ];
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }
    
    formatLogContent(line) {
        // Remove timestamp from content if it exists
        const timestamp = this.extractTimestamp(line);
        if (timestamp) {
            line = line.replace(timestamp, '').trim();
        }
        
        // Escape HTML and preserve formatting
        return this.escapeHtml(line);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateStats(logText) {
        const lines = logText.split('\n').filter(line => line.trim());
        this.totalLinesElement.textContent = lines.length;
        this.lastUpdatedElement.textContent = new Date().toLocaleTimeString();
        
        // Update status based on bot state
        if (this.isBotRunning) {
            this.setStatus('Running', 'info');
        } else if (this.scheduledTask) {
            this.setStatus('Scheduled', 'info');
        } else {
            this.setStatus('Connected', 'success');
        }
    }
    
    setStatus(status, type) {
        this.statusElement.textContent = status;
        this.statusElement.className = `stat-value ${type || ''}`;
    }
    
    clearLogs() {
        this.logContent.innerHTML = '<div class="loading">Logs cleared. Click "Refresh Logs" to reload.</div>';
        this.totalLinesElement.textContent = '0';
        this.setStatus('Cleared', 'info');
        this.hideError();
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'flex';
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    // Bot control methods
    async startBot() {
        if (this.isBotRunning) return;
        
        this.isBotRunning = true;
        this.startBotBtn.disabled = true;
        this.stopBotBtn.disabled = false;
        
        // Disable schedule controls while bot is running
        this.scheduleEnabled.disabled = true;
        this.scheduleInterval.disabled = true;
        this.scheduleUnit.disabled = true;
        
        try {
            // Show loading state
            this.setStatus('Running', 'info');
            
            // Call the process-pdfs endpoint
            const response = await fetch('http://localhost:5000/process-pdfs', {
                method: 'GET'
            });            
            
            const result = await response.json();
            
            if (response.ok) {
                const msg = result.message || 'PDF processing started successfully';
                // this.addLogEntry(msg, 'success');
                this.showToast(msg, 'success');
                this.setStatus('Completed', 'success');
                
                // Start auto-refresh if not already running
                // if (!this.autoRefreshInterval) {
                //     this.autoRefreshCheckbox.checked = true;
                //     this.startAutoRefresh();
                // }
            } else {
                throw new Error(result.error || 'Failed to start bot');
            }
        } catch (error) {
            console.error('Error starting bot:', error);
            this.setStatus('Error', 'error');
            this.showToast(`Error: ${error.message}`, 'error');
            this.addLogEntry(`Error starting bot: ${error.message}`, 'error');
        } finally {
            // Always re-enable buttons
            this.isBotRunning = false;
            this.startBotBtn.disabled = false;
            this.stopBotBtn.disabled = true;
    
            // Re-enable schedule controls if needed
            this.scheduleEnabled.disabled = false;
            this.scheduleInterval.disabled = false;
            this.scheduleUnit.disabled = false;
        }
    }
    
    stopBot() {
        if (!this.isBotRunning) return;
        
        this.isBotRunning = false;
        this.startBotBtn.disabled = false;
        this.stopBotBtn.disabled = true;
        
        // Re-enable schedule controls when bot is stopped
        this.scheduleEnabled.disabled = false;
        this.scheduleInterval.disabled = false;
        this.scheduleUnit.disabled = false;
        this.scheduleBtn.disabled = false;
        
        // Clear any scheduled tasks
        this.clearScheduledTask();
        
        // Simulate bot stopping (in a real app, this would be an API call)
        this.addLogEntry('Bot stopped', 'info');
        this.setStatus('Bot Stopped', 'error');
    }
    
    handleScheduleToggle() {
        if (this.scheduleEnabled.checked) {
            this.enableSchedule();
        } else {
            this.disableSchedule();
        }
    }
    
    updateScheduleIfEnabled() {
        if (this.scheduleEnabled.checked) {
            this.enableSchedule();
        }
    }
    
    enableSchedule() {
        const interval = parseInt(this.scheduleInterval.value) || 5;
        const unit = this.scheduleUnit.value;
        
        // Convert to milliseconds
        let milliseconds = interval * 1000; // default to seconds
        if (unit === 'minutes') milliseconds = interval * 60 * 1000;
        if (unit === 'hours') milliseconds = interval * 60 * 60 * 1000;
        
        if (milliseconds < 1000) {
            this.showError('Interval must be at least 1 second');
            this.scheduleEnabled.checked = false;
            return;
        }
        
        this.scheduleBot(milliseconds);
        this.addLogEntry(`Bot scheduled to run every ${interval} ${unit}`, 'info');
    }
    
    disableSchedule() {
        this.clearScheduledTask();
        this.addLogEntry('Schedule disabled', 'info');
    }
    
    scheduleBot(intervalMs) {
        // Clear any existing schedule
        this.clearScheduledTask();
        
        // Create new schedule
        this.scheduledTask = setInterval(() => {
            if (!this.isBotRunning) {
                this.startBot();
            }
            // In a real app, this would trigger the bot to perform its task
            this.addLogEntry('Scheduled bot task executed', 'info');
        }, intervalMs);
        
        // Also start the bot immediately if not already running
        if (!this.isBotRunning) {
            this.startBot();
        }
    }
    
    clearScheduledTask() {
        if (this.scheduledTask) {
            clearInterval(this.scheduledTask);
            this.scheduledTask = null;
        }
    }
    
    addLogEntry(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logLine = document.createElement('div');
        logLine.className = `log-line ${type}`;
        logLine.innerHTML = `
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            ${message}
        `;
        
        // Insert at the top
        if (this.logContent.firstChild) {
            this.logContent.insertBefore(logLine, this.logContent.firstChild);
        } else {
            this.logContent.appendChild(logLine);
        }
        
        // Update stats
        const lines = this.logContent.querySelectorAll('.log-line').length;
        this.totalLinesElement.textContent = lines;
        this.lastUpdatedElement.textContent = new Date().toLocaleTimeString();
    }
    
    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval
        this.autoRefreshInterval = setInterval(() => {
            this.loadLogs();
        }, 5000); // Refresh every 5 seconds
        
        // Load logs immediately when auto-refresh is enabled
        this.loadLogs();
    }
    
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
}

// Initialize the log viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LogViewer();
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
    const logViewer = window.logViewer;
    if (logViewer && logViewer.autoRefreshCheckbox.checked) {
        if (document.hidden) {
            logViewer.stopAutoRefresh();
        } else {
            logViewer.startAutoRefresh();
        }
    }
});
