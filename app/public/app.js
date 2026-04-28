function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'incidents') fetchIncidents();
    if(tabId === 'runbook') fetchRunbooks();
}

async function fetchIncidents() {
    const res = await fetch('/incidents');
    const data = await res.json();
    const table = document.getElementById('incTable');
    table.innerHTML = '<tr><th>Title</th><th>Description</th><th>Severity</th><th>Date</th><th>Action</th></tr>';
    data.forEach(inc => {
        const dateStr = new Date(inc.date).toLocaleDateString();
        table.innerHTML += `<tr>
            <td>${inc.title}</td><td>${inc.description}</td><td>${inc.severity}</td><td>${dateStr}</td>
            <td>
                <button onclick="generateEmail('${inc.title}', '${inc.description}', '${inc.severity}', '${dateStr}')">Copy Email</button>
                <button onclick="deleteIncident('${inc.id}')">Delete</button>
            </td>
        </tr>`;
    });
}

async function addIncident() {
    const data = {
        title: document.getElementById('incTitle').value,
        description: document.getElementById('incDesc').value,
        severity: document.getElementById('incSev').value
    };
    await fetch('/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    fetchIncidents();
}

async function deleteIncident(id) {
    await fetch(`/incidents/${id}`, { method: 'DELETE' });
    fetchIncidents();
}

async function fetchRunbooks() {
    const res = await fetch('/runbooks');
    const data = await res.json();
    const table = document.getElementById('runbookTable');
    table.innerHTML = '<tr><th>Issue Type</th><th>Resolution Steps</th></tr>';
    data.forEach(rb => {
        table.innerHTML += `<tr><td>${rb.issue_type}</td><td>${rb.resolution_steps}</td></tr>`;
    });
}

function generateEmail(title, desc, sev, date) {
    const emailText = `Subject: [${sev.toUpperCase()}] ${title}\n\nTitle: ${title}\nDescription: ${desc}\nSeverity: ${sev}\nDate: ${date}`;
    navigator.clipboard.writeText(emailText).then(() => {
        alert("Email template copied to clipboard!");
    });
}

fetchIncidents();
