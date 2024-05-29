import express from 'express';
import fetch from 'node-fetch';
const app = express();

const PORT = 94;

app.get('/', async (req, res) => {
    let response = {};
    let containers = [];
    let customHTML = ``;
    let containerStatuses = {
        running: 0,
        stopped: 0,
        other: 0
    };

    try {
        response = await fetch('http://localhost:3009/api/containers/');
        containers = await response.json();
        containers.forEach(container => {
            if (container.status === 'running') {
                containerStatuses.running++;
            } else if (container.status === 'stopped') {
                containerStatuses.stopped++;
            } else {
                containerStatuses.other++;
            }
        });
    } catch (err) {
        console.log("error! docket.");
        customHTML = `<div style="background-color: #73121a; color: white; padding: 10px; margin-bottom: 20px;">
        <b>API Error:</b> Either the <span style="background-color: #000000; padding-left: 20px; padding-right: 20px; padding:5px; margin-left:5px; margin-right:5px;">visualizer.js</span> utility has been tampered with or the API is offline.
    </div>`;
    }

    // Generate the HTML table and chart
    let table = `
      <html>
      <head>
        <title>Docket Monitor</title>
        <style>
          body {
            background-color: #121212;
            color: #e0e0e0;
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 40px;
          }
          .container {
            display: flex;
          }
          .table-container {
            flex: 2;
          }
          .chart-container {
            flex: 1;
            margin-left: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #424242;
          }
          th {
            background-color: #1c1c1c;
          }
          tr:nth-child(even) {
            background-color: #2c2c2c;
          }
          tr:hover {
            background-color: #333;
          }
          .fake-data-btn {
            background-color: #0a64f5;
            color: white;
            padding: 10px 20px;
            border: none;
            cursor: pointer;
            margin-bottom: 20px;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
          function populateFakeData() {
            const fakeContainers = [
                { id: '0x1a2b3c4d5e6f', status: 'running' },
              { id: '0x6f5e4d3c2b1a', status: 'stopped' },
              { id: '0xa1b2c3d4e5f6', status: 'other' },
              { id: '0xf6e5d4c3b2a1', status: 'running' },
              { id: '0x5e4d3c2b1a0', status: 'stopped' }
            ];

            let tableContent = '';
            fakeContainers.forEach(container => {
              tableContent += \`
                <tr>
                  <td>\${container.id}</td>
                  <td>\${container.status}</td>
                </tr>
              \`;
            });

            document.getElementById('container-table').innerHTML = tableContent;

            const newChartData = [2, 2, 1];
            updateChart(statusChart, newChartData);
          }

          function updateChart(chart, data) {
            chart.data.datasets[0].data = data;
            chart.update();
          }
        </script>
      </head>
      <body>
        <div style="display: flex;">
          <h1><span style="color: #0a64f5;">Docket</span> Monitor</h1>
          <div style="margin-left: auto; text-align:right;">
            <p>&copy; CTFGuide Corporation 2024<br>MIT License</p>
          </div>
        </div>
        ` + customHTML + `
        <button class="fake-data-btn" onclick="populateFakeData()">Demo View</button>
        <div class="container">
          <div class="table-container">
            <table>
              <tr>
                <th>Container ID</th>
                <th>Status</th>
              </tr>
              <tbody id="container-table">
    `;

    containers.forEach(container => {
        table += `
                  <tr>
                    <td>${container.id}</td>
                    <td>${container.status}</td>
                  </tr>
        `;
    });

    table += `
              </tbody>
            </table>
          </div>
          <div class="chart-container">
            <canvas id="statusChart" width="400" height="200"></canvas>
          </div>
        </div>
        <script>
          const ctx = document.getElementById('statusChart').getContext('2d');
          const statusChart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ['Running', 'Stopped', 'Other'],
              datasets: [{
                label: 'Container Status',
                data: [${containerStatuses.running}, ${containerStatuses.stopped}, ${containerStatuses.other}],
                backgroundColor: [
                  'rgba(75, 192, 192, 0.2)',
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(255, 205, 86, 0.2)'
                ],
                borderColor: [
                  'rgba(75, 192, 192, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(255, 205, 86, 1)'
                ],
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'top',
                },
                title: {
                  display: true,
                  text: 'Container Status Distribution'
                }
              }
            },
          });
        </script>
      </body>
      </html>
    `;

    // Send the generated HTML as the response
    res.send(table);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
