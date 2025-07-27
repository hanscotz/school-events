// Main JavaScript for School Events

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Event registration form handling
    const registrationForms = document.querySelectorAll('.event-registration-form');
    registrationForms.forEach(form => {
        form.addEventListener('submit', handleEventRegistration);
    });

    // Event cancellation handling
    const cancelButtons = document.querySelectorAll('.cancel-registration-btn');
    cancelButtons.forEach(button => {
        button.addEventListener('click', handleEventCancellation);
    });

    // Notification handling
    const markReadButtons = document.querySelectorAll('.mark-read-btn');
    markReadButtons.forEach(button => {
        button.addEventListener('click', markNotificationAsRead);
    });

    // Mark all notifications as read
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    // Delete confirmation modals
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', confirmDelete);
    });

    // Form validation
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', validateForm);
    });

    // Auto-hide alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', smoothScroll);
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Filter functionality
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', handleFilter);
    });

    // Date picker initialization
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    dateInputs.forEach(input => {
        input.addEventListener('change', validateDate);
    });

    // Payment status updates
    const paymentStatusSelects = document.querySelectorAll('.payment-status-select');
    paymentStatusSelects.forEach(select => {
        select.addEventListener('change', updatePaymentStatus);
    });
});

// Event Registration Handler
async function handleEventRegistration(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const eventId = form.getAttribute('data-event-id');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<span class="loading"></span> Registering...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`/events/${eventId}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                studentId: formData.get('studentId')
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            // Refresh the page or update UI
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showAlert('danger', result.error);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('danger', 'An error occurred during registration. Please try again.');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Event Cancellation Handler
async function handleEventCancellation(event) {
    event.preventDefault();
    
    if (!confirm('Are you sure you want to cancel this registration?')) {
        return;
    }
    
    const button = event.target;
    const eventId = button.getAttribute('data-event-id');
    const studentId = button.getAttribute('data-student-id');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.innerHTML = '<span class="loading"></span> Cancelling...';
    button.disabled = true;
    
    try {
        const response = await fetch(`/events/${eventId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                studentId: studentId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            // Remove the registration row from the table
            const row = button.closest('tr');
            if (row) {
                row.remove();
            }
        } else {
            showAlert('danger', result.error);
        }
    } catch (error) {
        console.error('Cancellation error:', error);
        showAlert('danger', 'An error occurred while cancelling. Please try again.');
    } finally {
        // Reset button state
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Mark Notification as Read
async function markNotificationAsRead(event) {
    event.preventDefault();
    
    const button = event.target;
    const notificationId = button.getAttribute('data-notification-id');
    
    try {
        const response = await fetch(`/parents/notifications/${notificationId}/read`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update UI to show notification as read
            const notificationItem = button.closest('.notification-item');
            if (notificationItem) {
                notificationItem.classList.add('read');
                button.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

// Mark All Notifications as Read
async function markAllNotificationsAsRead(event) {
    event.preventDefault();
    
    const button = event.target;
    const originalText = button.innerHTML;
    
    button.innerHTML = '<span class="loading"></span> Marking all as read...';
    button.disabled = true;
    
    try {
        const response = await fetch('/parents/notifications/read-all', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update all notification items
            const notificationItems = document.querySelectorAll('.notification-item');
            notificationItems.forEach(item => {
                item.classList.add('read');
            });
            
            // Hide all mark read buttons
            const markReadButtons = document.querySelectorAll('.mark-read-btn');
            markReadButtons.forEach(btn => {
                btn.style.display = 'none';
            });
            
            showAlert('success', 'All notifications marked as read');
        }
    } catch (error) {
        console.error('Mark all read error:', error);
        showAlert('danger', 'An error occurred. Please try again.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Delete Confirmation
function confirmDelete(event) {
    event.preventDefault();
    
    const button = event.target;
    const itemName = button.getAttribute('data-item-name') || 'this item';
    
    if (confirm(`Are you sure you want to delete ${itemName}? This action cannot be undone.`)) {
        const form = button.closest('form');
        if (form) {
            form.submit();
        }
    }
}

// Form Validation
function validateForm(event) {
    const form = event.target;
    
    if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    form.classList.add('was-validated');
}

// Date Validation
function validateDate(event) {
    const input = event.target;
    const selectedDate = new Date(input.value);
    const currentDate = new Date();
    
    if (selectedDate < currentDate) {
        input.setCustomValidity('Please select a future date and time.');
    } else {
        input.setCustomValidity('');
    }
}

// Search Handler
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const searchableElements = document.querySelectorAll('.searchable');
    
    searchableElements.forEach(element => {
        const text = element.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

// Filter Handler
function handleFilter(event) {
    const filterValue = event.target.value;
    const filterableElements = document.querySelectorAll('.filterable');
    
    filterableElements.forEach(element => {
        const category = element.getAttribute('data-category');
        if (filterValue === '' || category === filterValue) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

// Update Payment Status
async function updatePaymentStatus(event) {
    const select = event.target;
    const registrationId = select.getAttribute('data-registration-id');
    const newStatus = select.value;
    
    try {
        const response = await fetch(`/admin/registrations/${registrationId}/payment-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentStatus: newStatus
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Payment status updated successfully');
        } else {
            showAlert('danger', result.error);
            // Revert the select value
            select.value = select.getAttribute('data-original-value');
        }
    } catch (error) {
        console.error('Payment status update error:', error);
        showAlert('danger', 'An error occurred while updating payment status');
        // Revert the select value
        select.value = select.getAttribute('data-original-value');
    }
}

// Smooth Scroll
function smoothScroll(event) {
    event.preventDefault();
    
    const targetId = event.target.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Show Alert
function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer') || document.body;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.insertBefore(alertDiv, alertContainer.firstChild);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
    }, 5000);
}

// Chart.js Integration for Reports
function initializeCharts() {
    // Monthly Revenue Chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        const revenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: revenueData.labels,
                datasets: [{
                    label: 'Monthly Revenue',
                    data: revenueData.values,
                    borderColor: '#6f42c1',
                    backgroundColor: 'rgba(111, 66, 193, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Event Participation Chart
    const participationCtx = document.getElementById('participationChart');
    if (participationCtx) {
        const participationChart = new Chart(participationCtx, {
            type: 'doughnut',
            data: {
                labels: participationData.labels,
                datasets: [{
                    data: participationData.values,
                    backgroundColor: [
                        '#6f42c1',
                        '#8e44ad',
                        '#a855f7',
                        '#c084fc',
                        '#e9d5ff'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }
}

// Export functionality
function exportToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    let csv = [];
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const rowData = [];
        cols.forEach(col => {
            rowData.push('"' + col.textContent.replace(/"/g, '""') + '"');
        });
        csv.push(rowData.join(','));
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Print functionality
function printPage() {
    window.print();
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPercentage(value, total) {
    return ((value / total) * 100).toFixed(1) + '%';
}

// Initialize charts when Chart.js is loaded
if (typeof Chart !== 'undefined') {
    initializeCharts();
} 

// Student search functionality
function searchStudents(searchTerm) {
    if (searchTerm.length < 2) {
        return Promise.resolve([]);
    }

    return fetch(`/parents/search-students?searchTerm=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.students;
            } else {
                console.error('Search students error:', data.error);
                return [];
            }
        })
        .catch(error => {
            console.error('Search students error:', error);
            return [];
        });
}

// Event search functionality
function searchEvents(filters = {}) {
    const queryParams = new URLSearchParams(filters);
    return fetch(`/parents/search-events?${queryParams.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.events;
            } else {
                console.error('Search events error:', data.error);
                return [];
            }
        })
        .catch(error => {
            console.error('Search events error:', error);
            return [];
        });
}

// Get events for specific student
function getStudentEvents(studentId) {
    return fetch(`/parents/students/${studentId}/events`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data;
            } else {
                console.error('Get student events error:', data.error);
                return null;
            }
        })
        .catch(error => {
            console.error('Get student events error:', error);
            return null;
        });
}

// Get event statistics
function getEventStats() {
    return fetch('/parents/event-stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data;
            } else {
                console.error('Get event stats error:', data.error);
                return null;
            }
        })
        .catch(error => {
            console.error('Get event stats error:', error);
            return null;
        });
}

// Initialize student search autocomplete
function initStudentSearch() {
    const studentSearchInputs = document.querySelectorAll('.student-search-input');
    
    studentSearchInputs.forEach(input => {
        let timeout;
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'student-search-results';
        resultsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 4px 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;
        
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(resultsContainer);

        input.addEventListener('input', function() {
            clearTimeout(timeout);
            const searchTerm = this.value.trim();
            
            if (searchTerm.length < 2) {
                resultsContainer.style.display = 'none';
                return;
            }

            timeout = setTimeout(() => {
                searchStudents(searchTerm).then(students => {
                    resultsContainer.innerHTML = '';
                    
                    if (students.length === 0) {
                        resultsContainer.innerHTML = '<div class="p-2 text-muted">No students found</div>';
                    } else {
                        students.forEach(student => {
                            const item = document.createElement('div');
                            item.className = 'p-2 border-bottom student-search-item';
                            item.style.cursor = 'pointer';
                            item.innerHTML = `
                                <div class="fw-bold">${student.first_name} ${student.last_name}</div>
                                <small class="text-muted">Grade ${student.grade}${student.section ? ` - ${student.section}` : ''}</small>
                            `;
                            
                            item.addEventListener('click', function() {
                                input.value = `${student.first_name} ${student.last_name}`;
                                input.dataset.studentId = student.id;
                                resultsContainer.style.display = 'none';
                                
                                // Trigger change event
                                const event = new Event('change', { bubbles: true });
                                input.dispatchEvent(event);
                            });
                            
                            item.addEventListener('mouseenter', function() {
                                this.style.backgroundColor = '#f8f9fa';
                            });
                            
                            item.addEventListener('mouseleave', function() {
                                this.style.backgroundColor = 'white';
                            });
                            
                            resultsContainer.appendChild(item);
                        });
                    }
                    
                    resultsContainer.style.display = 'block';
                });
            }, 300);
        });

        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    });
}

// Initialize event search functionality
function initEventSearch() {
    const searchForm = document.getElementById('searchForm');
    if (!searchForm) return;

    // Auto-submit on filter changes
    const filterInputs = searchForm.querySelectorAll('select, input[type="date"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', function() {
            searchForm.submit();
        });
    });

    // Debounced search input
    const searchInput = searchForm.querySelector('#searchTerm');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                searchForm.submit();
            }, 500);
        });
    }

    // View mode switching
    const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const viewSections = document.querySelectorAll('.view-section');
            viewSections.forEach(section => section.style.display = 'none');
            
            const selectedView = this.value;
            const targetSection = document.getElementById(selectedView + 'Events');
            if (targetSection) {
                targetSection.style.display = 'block';
            }
        });
    });
}

// Initialize all search functionality
document.addEventListener('DOMContentLoaded', function() {
    initStudentSearch();
    initEventSearch();
}); 