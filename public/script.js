document.addEventListener('DOMContentLoaded', () => {
    const sqlInput = document.getElementById('sqlInput');
    const executeBtn = document.getElementById('executeBtn');
    const resultTable = document.getElementById('resultTable');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const errorMsg = document.getElementById('errorMsg');
    const loading = document.getElementById('loading');
    const recordCount = document.getElementById('recordCount');

    // Make Ctrl+Enter execute the query
    sqlInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            executeBtn.click();
        }
    });

    executeBtn.addEventListener('click', async () => {
        const query = sqlInput.value.trim();

        if (!query) {
            showError('Please enter a SQL query.');
            return;
        }

        // Add a micro-animation to the button
        executeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => executeBtn.style.transform = '', 150);

        // Reset UI
        hideError();
        resultTable.classList.add('hidden');
        loading.classList.remove('hidden');
        recordCount.textContent = 'Executing...';

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to execute query');
            }

            renderTable(data.columns, data.records);

        } catch (error) {
            showError(error.message);
        } finally {
            loading.classList.add('hidden');
        }
    });

    function renderTable(columns, records) {
        // Clear previous table content
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (!columns || columns.length === 0) {
            recordCount.textContent = '0 rows';
            showError('Query executed successfully but returned no results.', true);
            return;
        }

        // Update record count badge
        recordCount.textContent = `${records.length} row${records.length !== 1 ? 's' : ''}`;

        // Create Header
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        // Create Body
        records.forEach(record => {
            const row = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                // Handle null and formatting
                let value = record[col];
                if (value === null) {
                    td.innerHTML = '<span style="color: #64748b; font-style: italic;">NULL</span>';
                } else if (typeof value === 'object') {
                    // Try to format dates nicely if it's a date object string from JSON
                    td.textContent = JSON.stringify(value);
                } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) {
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        td.textContent = `${day}/${month}/${d.getFullYear()}`;
                    } else {
                        td.textContent = value;
                    }
                } else {
                    td.textContent = value;
                }
                row.appendChild(td);
            });
            tableBody.appendChild(row);
        });

        // Show Table
        resultTable.classList.remove('hidden');

        // Add a subtle fade-in animation
        resultTable.style.opacity = '0';
        resultTable.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
            resultTable.style.opacity = '1';
        }, 10);
    }

    function showError(message, isInfo = false) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');

        if (isInfo) {
            errorMsg.style.background = 'var(--accent-glow)';
            errorMsg.style.color = '#93c5fd';
            errorMsg.style.borderColor = 'rgba(59, 130, 246, 0.2)';
        } else {
            errorMsg.style.background = 'var(--error-bg)';
            errorMsg.style.color = 'var(--error-color)';
            errorMsg.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            recordCount.textContent = 'Error';
        }

        // Add shake animation for errors
        if (!isInfo) {
            errorMsg.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
            setTimeout(() => {
                errorMsg.style.animation = '';
            }, 400);
        }
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }
});

// Add keyframes for shake animation dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
`;
document.head.appendChild(style);
