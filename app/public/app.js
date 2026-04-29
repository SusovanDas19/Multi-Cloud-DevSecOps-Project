// Global State Variable
let currentIncidents = [];

// Bulletproof Tab Switching
function switchTab(contentId, tabId) {
    // 1. Hide all tabs and content
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none'; // Force hide
    });
    
    // 2. Activate selected tab and content
    document.getElementById(tabId).classList.add('active');
    const activeContent = document.getElementById(contentId);
    activeContent.classList.add('active');
    activeContent.style.display = 'block'; // Force show
    
    // 3. Trigger API Calls
    if(contentId === 'incidents') fetchIncidents();
    if(contentId === 'runbook') fetchRunbooks();
    if(contentId === 'architecture') fetchGallery();
}

async function fetchIncidents() {
    try {
        const res = await fetch('/incidents');
        currentIncidents = await res.json(); // Store data globally
        
        const table = document.getElementById('incTable');
        table.innerHTML = '<tr><th>Title</th><th>Description</th><th>Severity</th><th>Date</th><th>Action</th></tr>';
        
        currentIncidents.forEach((inc, index) => {
            const dateStr = new Date(inc.date).toLocaleDateString();
            let sevColor = inc.severity === 'High' ? 'red' : (inc.severity === 'Medium' ? 'orange' : 'green');
            
            // Pass the array INDEX instead of raw strings to prevent JS crashes
            table.innerHTML += `<tr>
                <td>${inc.title}</td>
                <td>${inc.description}</td>
                <td><span style="font-weight:bold; color:${sevColor}">${inc.severity}</span></td>
                <td>${dateStr}</td>
                <td>
                    <button onclick="generateEmail(${index})">Copy Email</button>
                    <button style="background-color:#dc3545;" onclick="deleteIncident(${inc.id})">Delete</button>
                </td>
            </tr>`;
        });
    } catch (err) {
        console.error("Error fetching incidents:", err);
    }
}

async function addIncident() {
    const data = {
        title: document.getElementById('incTitle').value,
        description: document.getElementById('incDesc').value,
        severity: document.getElementById('incSev').value
    };
    if (!data.title || !data.description) return alert("Title and Description required.");

    await fetch('/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    document.getElementById('incTitle').value = '';
    document.getElementById('incDesc').value = '';
    fetchIncidents();
}

async function deleteIncident(id) {
    await fetch(`/incidents/${id}`, { method: 'DELETE' });
    fetchIncidents();
}

async function fetchRunbooks() {
    try {
        const res = await fetch('/runbooks');
        const data = await res.json();
        const table = document.getElementById('runbookTable');
        table.innerHTML = '<tr><th>Issue Type</th><th>Resolution Steps</th></tr>';
        data.forEach(rb => {
            table.innerHTML += `<tr><td><strong>${rb.issue_type}</strong></td><td>${rb.resolution_steps}</td></tr>`;
        });
    } catch (err) {
         console.error("Error fetching runbooks:", err);
    }
}

async function fetchGallery() {
    const container = document.getElementById('galleryContainer');
    container.innerHTML = '<p>Loading images from S3...</p>';
    try {
        const res = await fetch('/gallery');
        const urls = await res.json();
        
        if (!urls || urls.length === 0) {
            container.innerHTML = '<p>No images found in AWS S3 <code>arch_gallery/</code> folder. Have you uploaded them?</p>';
            return;
        }
        
        container.innerHTML = '';
        urls.forEach(url => {
            container.innerHTML += `<img src="${url}" alt="Architecture Diagram" style="width:100%; max-width:600px; border-radius:8px; border:1px solid #ddd; margin-bottom: 20px;">`;
        });
    } catch (err) {
        console.error("Error fetching gallery:", err);
        container.innerHTML = '<p style="color:red;">Error connecting to AWS S3. Check backend logs and credentials.</p>';
    }
}

// Ultra-robust Copy Fallback for HTTP (Non-Secure Contexts)
function generateEmail(index) {
    const inc = currentIncidents[index];
    const dateStr = new Date(inc.date).toLocaleDateString();
    const emailText = `Subject: [${inc.severity.toUpperCase()}] ${inc.title}\n\nTitle: ${inc.title}\nDescription: ${inc.description}\nSeverity: ${inc.severity}\nDate: ${dateStr}`;
    
    // 1. Create a temporary text area
    const textArea = document.createElement("textarea");
    textArea.value = emailText;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0"; // Make invisible
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        // 2. Attempt legacy copy command
        const successful = document.execCommand('copy');
        if (successful) {
            alert("Email template copied to clipboard!");
        } else {
            // 3. Guaranteed Fallback if browser entirely blocks scripts from copying
            window.prompt("Copy failed (Browser Blocked). Press Ctrl+C / Cmd+C to copy the text below:", emailText);
        }
    } catch (err) {
        window.prompt("Copy failed (Browser Blocked). Press Ctrl+C / Cmd+C to copy the text below:", emailText);
    }
    
    document.body.removeChild(textArea);
}

// Initial load
fetchIncidents();
