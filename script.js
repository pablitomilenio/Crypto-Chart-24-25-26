// Leverage factor, default is 4x
const leverage = 4;

// Define the start and end dates for filtering
const startDate = '02/01/2021'; // MM/DD/YYYY
const endDate = '09/15/2021';   // MM/DD/YYYY

// Function to read and parse the CSV file
function readCSV(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'solana.csv', true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status == 0)) {
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

    // Convert start and end dates to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');

        // Skip lines that don't have the correct number of columns
        if (currentLine.length !== headers.length) {
            continue;
        }

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentLine[j];
        }

        // Parse the date from the current line
        const currentDate = new Date(obj.Date);

        // Check if the current date is within the desired range
        if (currentDate >= start && currentDate <= end) {
            data.push(obj);
        }
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

    // Initialize variables
    const initialCash = 240000; // Initial portfolio value
    let cash = initialCash; // Current cash position
    let invested = true; // Whether we currently hold a position
    let entryPrice = closes[0]; // Price at which the position was entered
    let numUnits = (cash / entryPrice) * leverage; // Number of units shorted
    let maxPrice = entryPrice; // Maximum price observed since entry
    const portfolioValues = []; // Array to hold portfolio values
    const investmentStatus = []; // Array to hold investment status (true/false)

    for (let i = 0; i < closes.length; i++) {
        const price = closes[i];

        if (invested) {
            // Update maxPrice
            if (price > maxPrice) {
                maxPrice = price;
            }

            // Calculate stop-loss price (10% increase from entryPrice)
            const stopLossPrice = entryPrice * 1.10;

            if (price >= stopLossPrice) {
                // Stop-loss triggered: liquidate position
                const profitLoss = (entryPrice - price) * numUnits;
                cash += profitLoss;
                invested = false;
                portfolioValues.push(cash); // Record portfolio value
                numUnits = 0; // Reset number of units
                // Indicate stop-loss event (optional)
                console.log(`Stop-loss triggered on ${dates[i]} at price ${price.toFixed(2)}`);
            } else {
                // Position is still open
                const profitLoss = (entryPrice - price) * numUnits;
                portfolioValues.push(cash + profitLoss);
            }
        } else {
            // Not invested: portfolio value remains constant
            portfolioValues.push(cash);
        }

        // Record investment status
        investmentStatus.push(invested);

        // Check for local maximum to re-invest
        if (!invested && i > 0 && i < closes.length - 1) {
            const prevPrice = closes[i - 1];
            const nextPrice = closes[i + 1];

            if (price > prevPrice && price > nextPrice) {
                // Local maximum detected: re-invest
                invested = true;
                entryPrice = price;
                maxPrice = price;
                numUnits = (cash / entryPrice) * leverage;
                console.log(`Re-invested on ${dates[i]} at price ${price.toFixed(2)}`);

                // Update portfolio value after re-investment
                const profitLoss = (entryPrice - price) * numUnits;
                portfolioValues[i] = cash + profitLoss;
            }
        }
    }

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
                    borderColor: 'rgba(255, 99, 132, 1)', // Default color
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1,
                    segment: {
                        borderColor: ctx => {
                            const index = ctx.p0DataIndex;
                            const invested = investmentStatus[index];
                            return invested ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)';
                        }
                    }
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
                            day: 'MMM DD YYYY'
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
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
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
