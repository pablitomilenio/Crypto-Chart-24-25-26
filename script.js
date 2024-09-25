// Function to read and parse the CSV file
function readCSV(callback) {
    // Create a new XMLHttpRequest object
    var xhr = new XMLHttpRequest();
    // Configure it: GET-request for the URL /solana.csv
    xhr.open('GET', 'solana.csv', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status == 0)) {
            // Call the callback function with the response text
            callback(xhr.responseText);
        }
    };
    xhr.send();
}

// Function to parse CSV data into JSON
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentLine[j];
        }
        data.push(obj);
    }
    return data;
}

// Function to render the chart
function renderChart(data) {
    // Extract dates and close prices
    const dates = data.map(item => item.Date);
    const closes = data.map(item => parseFloat(item.Close));

    // Reverse arrays for chronological order
    dates.reverse();
    closes.reverse();

    // Calculate the number of units shorted at the initial price
    const initialCash = 240000; // Initial portfolio value
    const initialPrice = closes[0]; // Initial close price
    const numUnits = initialCash / initialPrice;

    // Calculate portfolio values over time
    const portfolioValues = closes.map(price => {
        const profitLoss = (initialPrice - price) * numUnits;
        const portfolioValue = initialCash + profitLoss;
        return portfolioValue;
    });

    // Get the canvas context
    const ctx = document.getElementById('myChart').getContext('2d');

    // Create a new Chart instance
    new Chart(ctx, {
        type: 'line', // Specify the chart type
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Close Price',
                    data: closes,
                    yAxisID: 'y',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Portfolio Value',
                    data: portfolioValues,
                    yAxisID: 'y1',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        parser: 'MM/DD/YYYY',
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM DD'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Close Price (USD)'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Portfolio Value (USD)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
}

// Main function to execute on page load
window.onload = function () {
    readCSV(function (csvData) {
        const jsonData = parseCSV(csvData);
        renderChart(jsonData);
    });
};
