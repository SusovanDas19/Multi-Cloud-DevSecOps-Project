function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'incidents') fetchIncidents();
}

async function fetchIncidents() {
    const res = await fetch('/incidents');
    const data = await res.json();
    const table = document.getElementById('incTable');
    table.innerHTML = '<tr><th>Title</th><th>Description</th><th>Severity</th><th>Action</th></tr>';
    data.forEach(inc => {
        table.innerHTML += `<tr>
            <td>${inc.title}</td><td>${inc.description}</td><td>${inc.severity}</td>
            <td><button onclick="deleteIncident('${inc.id}')">Delete</button></td>
        </tr>`;
    });
}

async function addIncident() {
    const data = {
        title: document.getElementById('incTitle').value,
        description: document.getElementById('incDesc').value,
        severity: document.getElementById('incSev').value
    };
    await fetch('/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    fetchIncidents();
}

async function deleteIncident(id) {
    await fetch(`/incidents/${id}`, { method: 'DELETE' });
    fetchIncidents();
}

async function uploadImage() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return alert("Select an image first");

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('uploadResult').innerHTML = `File uploaded! <a href="${data.url}" target="_blank">View Here</a>`;
}

// Load incidents on start
fetchIncidents();
