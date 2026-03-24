document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const sqlInput = document.getElementById('sqlInput');
    const lineNumbers = document.getElementById('lineNumbers');
    const executeBtn = document.getElementById('executeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const formatBtn = document.getElementById('formatBtn');
    
    const schemaList = document.getElementById('schemaList');
    const schemaSearch = document.getElementById('schemaSearch');
    
    const tableContainer = document.getElementById('tableContainer');
    const resultTable = document.getElementById('resultTable');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    // States
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMsgText = document.getElementById('errorMsgText');
    const resultsStats = document.getElementById('resultsStats');
    const execTime = document.getElementById('execTime');
    const recordCount = document.getElementById('recordCount');

    // Toast
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    let dbSchema = {}; // Stores fetched schema

    // --- Initialization ---
    initEditor();
    fetchSchema();

    // --- Editor Logic ---
    function initEditor() {
        // Sync line numbers
        sqlInput.addEventListener('input', updateLineNumbers);
        sqlInput.addEventListener('scroll', () => {
            lineNumbers.scrollTop = sqlInput.scrollTop;
        });

        // Ctrl+Enter to execute
        sqlInput.addEventListener('keydown', (e) => {
            // Tab support
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = sqlInput.selectionStart;
                const end = sqlInput.selectionEnd;
                sqlInput.value = sqlInput.value.substring(0, start) + "    " + sqlInput.value.substring(end);
                sqlInput.selectionStart = sqlInput.selectionEnd = start + 4;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeBtn.click();
            }
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            sqlInput.value = '';
            updateLineNumbers();
            sqlInput.focus();
        });

        // Format button (Basic uppercase formatting)
        formatBtn.addEventListener('click', () => {
            let text = sqlInput.value;
            if (!text.trim()) return;
            
            // Very basic uppercase formatting for SQL keywords
            const keywords = ['select', 'from', 'where', 'and', 'or', 'join', 'inner join', 'left join', 'right join', 'on', 'group by', 'order by', 'having', 'limit', 'as', 'in', 'is null', 'not null'];
            keywords.forEach(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, 'gi');
                text = text.replace(regex, kw.toUpperCase());
            });
            sqlInput.value = text;
            showToast('Query formatted');
        });

        updateLineNumbers();
    }

    function updateLineNumbers() {
        const lines = sqlInput.value.split('\n').length;
        let numbersHTML = '';
        for (let i = 1; i <= lines; i++) {
            numbersHTML += `${i}<br>`;
        }
        lineNumbers.innerHTML = numbersHTML || '1';
    }

    // --- Schema Sidebar Logic ---
    async function fetchSchema() {
        try {
            const res = await fetch('/api/schema');
            const data = await res.json();
            
            if (data.success) {
                dbSchema = data.schema;
                renderSchema(dbSchema);
            } else {
                schemaList.innerHTML = `<div class="loading-state text-error"><i class="ph ph-warning"></i> Failed to load schema</div>`;
            }
        } catch (err) {
            schemaList.innerHTML = `<div class="loading-state text-error"><i class="ph ph-warning"></i> Error loading schema</div>`;
        }
    }

    function renderSchema(schemaObject, filterText = '') {
        const tables = Object.keys(schemaObject).sort();
        if (tables.length === 0) {
            schemaList.innerHTML = `<div class="loading-state">No tables found.</div>`;
            return;
        }

        let html = '';
        const filterLower = filterText.toLowerCase();

        tables.forEach(tableName => {
            const columns = schemaObject[tableName];
            // Filter logic
            const tableMatch = tableName.toLowerCase().includes(filterLower);
            const matchingCols = columns.filter(c => c.name.toLowerCase().includes(filterLower));
            
            if (filterText && !tableMatch && matchingCols.length === 0) return; // Skip if no match
            
            const renderCols = filterText && !tableMatch ? matchingCols : columns;

            html += `
                <div class="schema-table">
                    <div class="table-header" onclick="toggleTable('${tableName}')">
                        <i class="ph-fill ph-table table-icon"></i>
                        <span>${tableName}</span>
                        <div style="flex-grow:1"></div>
                        <i class="ph ph-caret-right" id="caret-${tableName}" style="font-size:0.8rem; transition:transform 0.2s"></i>
                    </div>
                    <div class="table-columns" id="cols-${tableName}">
                        ${renderCols.map(col => `
                            <div class="column-item" onclick="insertText('${col.name}')">
                                <span>${col.name}</span>
                                <span class="column-type">${col.type}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        if (!html) {
            schemaList.innerHTML = `<div class="loading-state">No matches found.</div>`;
        } else {
            schemaList.innerHTML = html;
        }

        // Add context menu / click to insert table name
        document.querySelectorAll('.table-header').forEach(el => {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const tableName = el.querySelector('span').innerText;
                insertText(`SELECT * FROM ${tableName}`);
            });
        });
    }

    // Make toggleTable global for inline onclick
    window.toggleTable = function(tableName) {
        const colsDiv = document.getElementById(`cols-${tableName}`);
        const caret = document.getElementById(`caret-${tableName}`);
        if (colsDiv.classList.contains('expanded')) {
            colsDiv.classList.remove('expanded');
            caret.style.transform = 'rotate(0deg)';
        } else {
            colsDiv.classList.add('expanded');
            caret.style.transform = 'rotate(90deg)';
        }
    };

    window.insertText = function(text) {
        const start = sqlInput.selectionStart;
        const end = sqlInput.selectionEnd;
        sqlInput.value = sqlInput.value.substring(0, start) + text + sqlInput.value.substring(end);
        sqlInput.selectionStart = sqlInput.selectionEnd = start + text.length;
        sqlInput.focus();
        showToast(`Inserted: ${text}`);
    };

    schemaSearch.addEventListener('input', (e) => {
        renderSchema(dbSchema, e.target.value);
    });

    // --- Execution Logic ---
    executeBtn.addEventListener('click', async () => {
        const query = sqlInput.value.trim();
        if (!query) {
            showToast('Please enter a query.', true);
            return;
        }

        // Add button animation
        executeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => executeBtn.style.transform = '', 150);

        // UI Reset
        switchState('loading');
        const startTime = performance.now();

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            const timeTaken = Math.round(performance.now() - startTime);

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Execution failed');
            }

            // Update stats
            execTime.innerText = `${timeTaken}ms`;
            
            if (data.records && data.records.length > 0) {
                const count = data.records.length;
                recordCount.innerText = `${count} row${count !== 1 ? 's' : ''}`;
                resultsStats.classList.remove('hidden');
                renderTable(data.columns, data.records);
            } else {
                recordCount.innerText = `${data.rowsAffected} row(s) affected`;
                resultsStats.classList.remove('hidden');
                switchState('empty');
                showToast(`Query executed successfully. ${data.rowsAffected} row(s) affected.`, false);
            }

        } catch (error) {
            errorMsgText.innerText = error.message;
            switchState('error');
            resultsStats.classList.add('hidden');
        }
    });

    function switchState(state) {
        emptyState.classList.add('hidden');
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        tableContainer.classList.add('hidden');

        if (state === 'empty') emptyState.classList.remove('hidden');
        if (state === 'loading') loadingState.classList.remove('hidden');
        if (state === 'error') errorState.classList.remove('hidden');
        if (state === 'table') tableContainer.classList.remove('hidden');
    }

    function renderTable(columns, records) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (!columns || columns.length === 0) {
            switchState('empty');
            showToast('Query executed successfully. (0 rows)', false);
            return;
        }

        // Header
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        // Body
        records.forEach(record => {
            const row = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                const val = record[col];
                
                // Styling based on type
                if (val === null) {
                    td.innerHTML = '<span class="cell-null">NULL</span>';
                } else if (typeof val === 'number') {
                    td.innerHTML = `<span class="cell-number">${val}</span>`;
                } else if (typeof val === 'boolean') {
                    td.innerHTML = `<span class="cell-boolean">${val}</span>`;
                } else if (typeof val === 'object') {
                    // Try date parsing
                    const dateStr = JSON.stringify(val).replace(/"/g,'');
                    if (Date.parse(dateStr)) {
                        const d = new Date(dateStr);
                        td.textContent = d.toLocaleString();
                    } else {
                        td.textContent = JSON.stringify(val);
                    }
                } else {
                    td.innerHTML = `<span class="cell-string">${escapeHtml(String(val))}</span>`;
                }
                
                row.appendChild(td);
            });
            tableBody.appendChild(row);
        });

        switchState('table');
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    // --- Toast Logic ---
    let toastTimeout;
    function showToast(message, isError = false) {
        clearTimeout(toastTimeout);
        
        toastMsg.innerText = message;
        if (isError) {
            toast.classList.add('error');
            toastIcon.className = 'ph-fill ph-warning-circle';
        } else {
            toast.classList.remove('error');
            toastIcon.className = 'ph-fill ph-check-circle';
        }

        toast.classList.add('show');
        
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
