// FIX: Safely handles element passing to avoid crash
function switchTab(tabId, element) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
    
    if (element) {
        element.classList.add('active');
    } else {
        // Fallback if element is not passed
        document.querySelector(`.tab[onclick*="${tabId}"]`).classList.add('active');
    }
    
    document.getElementById(tabId).classList.add('active');
    
    // Explicitly call the fetches
    if(tabId === 'incidents') fetchIncidents();
    if(tabId === 'runbook') fetchRunbooks();
    if(tabId === 'architecture') fetchGallery();
}

async function fetchIncidents() {
    try {
        const res = await fetch('/incidents');
        const data = await res.json();
        const table = document.getElementById('incTable');
        table.innerHTML = '<tr><th>Title</th><th>Description</th><th>Severity</th><th>Date</th><th>Action</th></tr>';
        data.forEach(inc => {
            const dateStr = new Date(inc.date).toLocaleDateString();
            const escTitle = inc.title.replace(/'/g, "\\'");
            const escDesc = inc.description.replace(/'/g, "\\'");
            table.innerHTML += `<tr>
                <td>${inc.title}</td><td>${inc.description}</td><td><span style="font-weight:bold; color:${inc.severity==='High'?'red':inc.severity==='Medium'?'orange':'green'}">${inc.severity}</span></td><td>${dateStr}</td>
                <td>
                    <button onclick="generateEmail('${escTitle}', '${escDesc}', '${inc.severity}', '${dateStr}')">Copy Email</button>
                    <button style="background-color:#dc3545;" onclick="deleteIncident('${inc.id}')">Delete</button>
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
    container.innerHTML = 'Loading images from S3...';
    try {
        const res = await fetch('/gallery');
        const urls = await res.json();
        
        if (!urls || urls.length === 0) {
            container.innerHTML = '<p>No images found in AWS S3 <code>arch_gallery/</code> folder.</p>';
            return;
        }
        
        container.innerHTML = '';
        urls.forEach(url => {
            container.innerHTML += `<img src="${url}" alt="Architecture Diagram">`;
        });
    } catch (err) {
        console.error("Error fetching gallery:", err);
        container.innerHTML = '<p style="color:red;">Error connecting to AWS S3. Check backend logs and credentials.</p>';
    }
}

// FIX: Universal Copy Fallback for HTTP (Non-Secure Contexts)
function generateEmail(title, desc, sev, date) {
    const emailText = `Subject: [${sev.toUpperCase()}] ${title}\n\nTitle: ${title}\nDescription: ${desc}\nSeverity: ${sev}\nDate: ${date}`;
    
    // Create a temporary, invisible textarea
    const textArea = document.createElement("textarea");
    textArea.value = emailText;
    
    // Make sure it doesn't cause scrolling
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert("Email template copied to clipboard!");
        } else {
            alert("Copy failed. Please manually select and copy.");
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        alert("Copy failed. Browser blocked the action.");
    }
    
    document.body.removeChild(textArea);
}

// Initial load
fetchIncidents();
