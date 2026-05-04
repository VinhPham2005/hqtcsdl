document.addEventListener('DOMContentLoaded', () => {
    const queryInput = document.getElementById('queryInput');
    const lineNumbers = document.getElementById('lineNumbers');
    const executeBtn = document.getElementById('executeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const formatBtn = document.getElementById('formatBtn');
    const collectionCount = document.getElementById('collectionCount');

    const schemaList = document.getElementById('schemaList');
    const schemaSearch = document.getElementById('schemaSearch');

    const tableContainer = document.getElementById('tableContainer');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');

    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMsgText = document.getElementById('errorMsgText');
    const resultsStats = document.getElementById('resultsStats');
    const execTime = document.getElementById('execTime');
    const recordCount = document.getElementById('recordCount');

    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    let dbSchema = {};

    initEditor();
    fetchSchema();

    // ─── Editor ──────────────────────────────────────────────────────────────
    function initEditor() {
        queryInput.addEventListener('input', updateLineNumbers);
        queryInput.addEventListener('scroll', () => {
            lineNumbers.scrollTop = queryInput.scrollTop;
        });

        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = queryInput.selectionStart;
                const end = queryInput.selectionEnd;
                queryInput.value = queryInput.value.substring(0, s) + '  ' + queryInput.value.substring(end);
                queryInput.selectionStart = queryInput.selectionEnd = s + 2;
                updateLineNumbers();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeBtn.click();
            }
        });

        clearBtn.addEventListener('click', () => {
            queryInput.value = '';
            updateLineNumbers();
            queryInput.focus();
            showToast('Cleared');
        });

        formatBtn.addEventListener('click', () => {
            const raw = queryInput.value.trim();
            const parsed = parseQuery(raw);
            if (!parsed) { showToast('Cannot format — invalid query syntax', true); return; }

            // Rebuild a nicely formatted query
            try {
                const filterStr = JSON.stringify(parsed.filter, null, 2);
                let result = `db.${parsed.collection}.find(${filterStr})`;
                if (parsed.sort) result += `.sort(${JSON.stringify(parsed.sort, null, 2)})`;
                if (parsed.limit) result += `.limit(${parsed.limit})`;
                queryInput.value = result;
                updateLineNumbers();
                showToast('Query formatted');
            } catch {
                showToast('Format error', true);
            }
        });

        updateLineNumbers();
    }

    function updateLineNumbers() {
        const lines = queryInput.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) html += `${i}<br>`;
        lineNumbers.innerHTML = html || '1';
    }

    // ─── Parse query string ─────────────────────────────────────────────────
    // Supports: db.collection.find({...}).sort({...}).limit(N)
    //           db.collection.aggregate([...])
    function parseQuery(raw) {
        if (!raw) return null;

        // Collapse to single line for regex matching
        const singleLine = raw.replace(/\n/g, ' ').trim();

        // Detect aggregate
        const aggPrefix = singleLine.match(/^db\.(\w+)\.aggregate\s*\(/);
        if (aggPrefix) {
            return parseAggregate(singleLine, aggPrefix[1], aggPrefix[0].length);
        }

        // Detect find
        const findMatch = singleLine.match(/^db\.(\w+)\.find\(/);
        if (!findMatch) return null;

        return parseQuerySmart(singleLine);
    }

    // Parse db.collection.aggregate([...])
    function parseAggregate(raw, collection, startPos) {
        const args = extractBalancedParens(raw, startPos);
        if (args === null) return null;

        const content = args.content.trim();
        if (!content.startsWith('[')) return null;

        try {
            // Convert MongoDB shell syntax to valid JSON
            const jsonStr = convertRegexToJSON(content);
            const pipeline = JSON.parse(jsonStr);
            if (!Array.isArray(pipeline)) return null;
            return { type: 'aggregate', collection, pipeline };
        } catch {
            return null;
        }
    }

    function parseQuerySmart(raw) {
        // Match: db.<collection>.find(
        const prefix = raw.match(/^db\.(\w+)\.find\(/);
        if (!prefix) return null;

        const collection = prefix[1];
        let pos = prefix[0].length;

        // Extract balanced args for find()
        const findArgs = extractBalancedParens(raw, pos);
        if (findArgs === null) return null;
        pos = findArgs.endPos; // position after closing )

        // Parse filter (and optional projection) from find args
        let filter = {};
        let projection = null;
        const findContent = findArgs.content.trim();

        if (findContent) {
            // Try to split into filter, projection (two JSON objects)
            const jsonObjects = splitTopLevelJSON(findContent);
            if (jsonObjects.length >= 1) {
                try { filter = JSON.parse(convertRegexToJSON(jsonObjects[0])); } catch { return null; }
            }
            if (jsonObjects.length >= 2) {
                try { projection = JSON.parse(convertRegexToJSON(jsonObjects[1])); } catch {}
            }
        }

        // Parse optional chained .sort() and .limit()
        let sort = null;
        let limit = null;
        const chainRemainder = raw.substring(pos).trim();

        const sortMatch = chainRemainder.match(/\.sort\((\{[\s\S]*?\})\)/);
        if (sortMatch) {
            try { sort = JSON.parse(sortMatch[1]); } catch {}
        }

        const limitMatch = chainRemainder.match(/\.limit\((\d+)\)/);
        if (limitMatch) {
            limit = parseInt(limitMatch[1]);
        }

        return { type: 'find', collection, filter, projection, sort, limit };
    }

    // Extract content between balanced parentheses starting at pos (which is right after '(')
    function extractBalancedParens(str, startPos) {
        let depth = 1;
        let i = startPos;
        while (i < str.length && depth > 0) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') depth--;
            if (depth > 0) i++;
        }
        if (depth !== 0) return null;
        return { content: str.substring(startPos, i), endPos: i + 1 };
    }

    // Split top-level comma-separated JSON objects: { ... }, { ... }
    function splitTopLevelJSON(str) {
        const results = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '{') { if (depth === 0) start = i; depth++; }
            else if (str[i] === '}') { depth--; if (depth === 0 && start >= 0) { results.push(str.substring(start, i + 1)); start = -1; } }
        }
        return results;
    }

    // Convert MongoDB shell syntax to valid JSON for JSON.parse()
    // Handles: regex literals, $regex operator with regex, and unquoted keys
    function convertRegexToJSON(str) {
        // Step 1: Handle $regex: /pattern/flags  →  "$regex": "pattern", "$options": "flags"
        str = str.replace(/\$regex\s*:\s*\/([^/]*)\/([a-z]*)/g, (m, pattern, flags) => {
            const escaped = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return flags
                ? `"$regex": "${escaped}", "$options": "${flags}"`
                : `"$regex": "${escaped}"`;
        });

        // Step 2: Handle direct regex literals as field values
        // "field": /pattern/flags  →  "field": {"$regex": "pattern", "$options": "flags"}
        str = str.replace(/:\s*\/([^/]*)\/([a-z]*)/g, (m, pattern, flags) => {
            const escaped = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return flags
                ? `: {"$regex": "${escaped}", "$options": "${flags}"}`
                : `: {"$regex": "${escaped}"}`;
        });

        // Step 3: Quote unquoted keys (bare words and $-prefixed operators like $gt, $lt, etc.)
        str = str.replace(/([{,]\s*)([a-zA-Z_$][\w.$]*)\s*:/g, '$1"$2":');

        return str;
    }

    // ─── Schema Sidebar ─────────────────────────────────────────────────────
    async function fetchSchema() {
        try {
            const res = await fetch('/api/schema');
            const data = await res.json();
            if (data.success) {
                dbSchema = data.schema;
                collectionCount.textContent = Object.keys(dbSchema).length;
                renderSchema(dbSchema);
            } else {
                schemaList.innerHTML = '<div class="loading-state text-error"><i class="ph ph-warning"></i> Failed to load</div>';
            }
        } catch {
            schemaList.innerHTML = '<div class="loading-state text-error"><i class="ph ph-warning"></i> Connection error</div>';
        }
    }

    function renderSchema(schemaObj, filterText = '') {
        const collections = Object.keys(schemaObj).sort();
        if (collections.length === 0) {
            schemaList.innerHTML = '<div class="loading-state">No collections found.</div>';
            return;
        }

        let html = '';
        const fl = filterText.toLowerCase();

        collections.forEach(colName => {
            const fields = schemaObj[colName];
            const colMatch = colName.toLowerCase().includes(fl);
            const matchFields = fields.filter(f => f.name.toLowerCase().includes(fl));
            if (filterText && !colMatch && matchFields.length === 0) return;
            const renderFields = filterText && !colMatch ? matchFields : fields;

            html += `<div class="schema-table">
                <div class="table-header" onclick="toggleTable('${colName}')">
                    <i class="ph-fill ph-folder-simple table-icon"></i>
                    <span>${colName}</span>
                    <span class="field-count">${fields.length}</span>
                    <i class="ph ph-caret-right" id="caret-${colName}" style="font-size:0.8rem;transition:transform 0.2s"></i>
                </div>
                <div class="table-columns" id="cols-${colName}">
                    ${renderFields.map(f => `<div class="column-item" onclick="insertField('${colName}','${f.name}')">
                        <span>${f.name}</span><span class="column-type">${f.type}</span>
                    </div>`).join('')}
                </div>
            </div>`;
        });

        schemaList.innerHTML = html || '<div class="loading-state">No matches.</div>';
    }

    window.toggleTable = function(name) {
        const colsDiv = document.getElementById(`cols-${name}`);
        const caret = document.getElementById(`caret-${name}`);
        if (colsDiv.classList.contains('expanded')) {
            colsDiv.classList.remove('expanded');
            caret.style.transform = 'rotate(0deg)';
        } else {
            colsDiv.classList.add('expanded');
            caret.style.transform = 'rotate(90deg)';
        }
    };

    // Click field → insert "field": into textarea
    window.insertField = function(colName, fieldName) {
        const pos = queryInput.selectionStart;
        const text = `"${fieldName}": `;
        queryInput.value = queryInput.value.substring(0, pos) + text + queryInput.value.substring(pos);
        queryInput.selectionStart = queryInput.selectionEnd = pos + text.length;
        queryInput.focus();
        showToast(`Inserted: ${fieldName}`);
    };

    // Double-click collection header → insert db.collection.find({})
    schemaList.addEventListener('dblclick', (e) => {
        const header = e.target.closest('.table-header');
        if (header) {
            const colName = header.querySelector('span').innerText;
            queryInput.value = `db.${colName}.find({})`;
            updateLineNumbers();
            queryInput.focus();
            showToast(`Query: db.${colName}.find({})`);
        }
    });

    schemaSearch.addEventListener('input', (e) => {
        renderSchema(dbSchema, e.target.value);
    });

    // ─── Execute ─────────────────────────────────────────────────────────────
    executeBtn.addEventListener('click', async () => {
        const raw = queryInput.value.trim();
        if (!raw) { showToast('Please enter a query', true); return; }

        const parsed = parseQuery(raw);
        if (!parsed) {
            showToast('Invalid syntax. Use: db.col.find({}) or db.col.aggregate([])', true);
            return;
        }

        executeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => executeBtn.style.transform = '', 150);

        switchState('loading');
        const startTime = performance.now();

        try {
            let apiUrl, body;

            if (parsed.type === 'aggregate') {
                apiUrl = '/api/aggregate';
                body = { collection: parsed.collection, pipeline: parsed.pipeline };
            } else {
                apiUrl = '/api/query';
                body = { collection: parsed.collection, filter: parsed.filter };
                if (parsed.projection) body.projection = parsed.projection;
                if (parsed.sort) body.sort = parsed.sort;
                if (parsed.limit) body.limit = parsed.limit;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            const timeTaken = Math.round(performance.now() - startTime);

            if (!response.ok || !data.success) throw new Error(data.error || 'Execution failed');

            execTime.innerText = `${timeTaken}ms`;

            if (data.records && data.records.length > 0) {
                recordCount.innerText = `${data.records.length} doc${data.records.length !== 1 ? 's' : ''}`;
                resultsStats.classList.remove('hidden');
                renderTable(data.columns, data.records);
            } else {
                recordCount.innerText = '0 docs';
                resultsStats.classList.remove('hidden');
                switchState('empty');
                showToast('Query returned 0 documents');
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

        if (!columns || columns.length === 0) { switchState('empty'); return; }

        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        records.forEach(record => {
            const row = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                const val = record[col];
                if (val === null || val === undefined) {
                    td.innerHTML = '<span class="cell-null">null</span>';
                } else if (typeof val === 'number') {
                    td.innerHTML = `<span class="cell-number">${val}</span>`;
                } else if (typeof val === 'boolean') {
                    td.innerHTML = `<span class="cell-boolean">${val}</span>`;
                } else {
                    const str = String(val);
                    if (str.length > 80) {
                        td.innerHTML = `<span class="cell-string" title="${escapeHtml(str)}">${escapeHtml(str.substring(0, 80))}…</span>`;
                    } else {
                        td.innerHTML = `<span class="cell-string">${escapeHtml(str)}</span>`;
                    }
                }
                row.appendChild(td);
            });
            tableBody.appendChild(row);
        });
        switchState('table');
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // ─── Toast ───────────────────────────────────────────────────────────────
    let toastTimeout;
    function showToast(message, isError = false) {
        clearTimeout(toastTimeout);
        toastMsg.innerText = message;
        toast.classList.toggle('error', isError);
        toastIcon.className = isError ? 'ph-fill ph-warning-circle' : 'ph-fill ph-check-circle';
        toast.classList.add('show');
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
