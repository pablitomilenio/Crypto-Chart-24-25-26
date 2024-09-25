// Leverage factor, default is 4x
const leverage = 1;

// Position type: 1 for short, 2 for long
const positionType = 2; // Set to 1 for short, 2 for long

// Define the start and end dates for filtering
const startDate = '01/01/2021'; // MM/DD/YYYY
const endDate = '05/31/2021';   // MM/DD/YYYY

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
    let invested = positionType === 1 || positionType === 2; // Whether we currently hold a position
    let entryPrice = closes[0]; // Price at which the position was entered
    let numUnits = (cash / entryPrice) * leverage; // Number of units bought or sold
    let maxPrice = entryPrice; // Maximum price observed since entry
    let minPrice = entryPrice; // Minimum price observed since entry
    const portfolioValues = []; // Array to hold portfolio values
    const investmentStatus = []; // Array to hold investment status (true/false)
    const reinvestmentPoints = []; // Array to hold reinvestment dates and prices
    const stopLossPoints = []; // Array to hold stop-loss trigger dates and prices

    for (let i = 0; i < closes.length; i++) {
        const price = closes[i];

        if (invested) {
            // Update maxPrice and minPrice
            if (price > maxPrice) {
                maxPrice = price;
            }
            if (price < minPrice) {
                minPrice = price;
            }

            // Calculate trailing stop-loss price
            let stopLossPrice;
            if (positionType === 1) {
                // Short position: Stop-loss at 10% increase from entryPrice
                stopLossPrice = entryPrice * 1.10;
                if (price >= stopLossPrice) {
                    // Stop-loss triggered: liquidate position
                    const profitLoss = (entryPrice - price) * numUnits;
                    cash += profitLoss;
                    invested = false;
                    portfolioValues.push(cash); // Record portfolio value
                    numUnits = 0; // Reset number of units
                    console.log(`Stop-loss triggered (Short) on ${dates[i]} at price ${price.toFixed(2)}`);

                    // Record the stop-loss point
                    stopLossPoints.push({ date: dates[i], price: price });
                } else {
                    // Position is still open
                    const profitLoss = (entryPrice - price) * numUnits;
                    portfolioValues.push(cash + profitLoss);
                }
            } else if (positionType === 2) {
                // Long position: Trailing stop-loss at 10% below maxPrice
                stopLossPrice = maxPrice * 0.90;
                if (price <= stopLossPrice) {
                    // Stop-loss triggered: liquidate position
                    const profitLoss = (price - entryPrice) * numUnits;
                    cash += profitLoss;
                    invested = false;
                    portfolioValues.push(cash); // Record portfolio value
                    numUnits = 0; // Reset number of units
                    console.log(`Trailing Stop-loss triggered (Long) on ${dates[i]} at price ${price.toFixed(2)}`);

                    // Record the stop-loss point
                    stopLossPoints.push({ date: dates[i], price: price });
                } else {
                    // Position is still open
                    const profitLoss = (price - entryPrice) * numUnits;
                    portfolioValues.push(cash + profitLoss);
                }
            }
        } else {
            // Not invested: portfolio value remains constant
            portfolioValues.push(cash);
        }

        // Record investment status
        investmentStatus.push(invested);

        // Check for re-entry conditions
        if (!invested && i > 0 && i < closes.length - 1) {
            const prevPrice = closes[i - 1];
            const nextPrice = closes[i + 1];

            if (positionType === 1) {
                // Short position: Re-invest at local maxima
                if (price > prevPrice && price > nextPrice) {
                    // Local maximum detected: re-invest
                    invested = true;
                    entryPrice = price;
                    maxPrice = price;
                    numUnits = (cash / entryPrice) * leverage;
                    console.log(`Re-invested (Short) on ${dates[i]} at price ${price.toFixed(2)}`);

                    // Record the reinvestment point
                    reinvestmentPoints.push({ date: dates[i], price: price });

                    // Update portfolio value after re-investment
                    const profitLoss = (entryPrice - price) * numUnits;
                    portfolioValues[i] = cash + profitLoss;
                }
            } else if (positionType === 2) {
                // Long position: Re-invest at local minima
                if (price < prevPrice && price < nextPrice) {
                    // Local minimum detected: re-invest
                    invested = true;
                    entryPrice = price;
                    maxPrice = price; // Reset maxPrice on re-entry
                    numUnits = (cash / entryPrice) * leverage;
                    console.log(`Re-invested (Long) on ${dates[i]} at price ${price.toFixed(2)}`);

                    // Record the reinvestment point
                    reinvestmentPoints.push({ date: dates[i], price: price });

                    // Update portfolio value after re-investment
                    const profitLoss = (price - entryPrice) * numUnits;
                    portfolioValues[i] = cash + profitLoss;
                }
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
                    borderColor: 'orange',
                    borderWidth: 3,
                    pointRadius: 0, // No points on the line
                    fill: false,
                    tension: 0.1
                },
                // Add the reinvestment points dataset
                {
                    label: 'Reinvestment Points',
                    data: reinvestmentPoints.map(point => ({ x: point.date, y: point.price })),
                    yAxisID: 'y',
                    type: 'scatter',
                    pointRadius: 6,
                    pointBackgroundColor: 'green', // Distinctive color
                    showLine: false
                },
                // Add the stop-loss points dataset
                {
                    label: 'Stop-Loss Points',
                    data: stopLossPoints.map(point => ({ x: point.date, y: point.price })),
                    yAxisID: 'y',
                    type: 'scatter',
                    pointRadius: 6,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)', // Distinctive color
                    showLine: false
                },
                {
                    label: 'Portfolio Value',
                    data: portfolioValues,
                    yAxisID: 'y1',
                    borderColor: 'rgba(0, 123, 255, 1)', // Default color
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1,
                    segment: {
                        borderColor: ctx => {
                            const index = ctx.p0DataIndex;
                            const invested = investmentStatus[index];
                            return invested ? 'magenta' : 'blue';
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
                    display: true,
                    labels: {
                        generateLabels: function (chart) {
                            const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            // Remove the default 'Portfolio Value' label
                            labels.splice(3, 1);
                            // Add custom labels for 'Invested' and 'Uninvested'
                            labels.push({
                                text: 'Portfolio Value (Invested)',
                                fillStyle: 'rgba(0, 123, 255, 1)',
                                strokeStyle: 'rgba(0, 123, 255, 1)',
                                lineWidth: 2,
                                hidden: false,
                                index: 3
                            });
                            labels.push({
                                text: 'Portfolio Value (Uninvested)',
                                fillStyle: 'rgba(108, 117, 125, 1)',
                                strokeStyle: 'rgba(108, 117, 125, 1)',
                                lineWidth: 2,
                                hidden: false,
                                index: 4
                            });
                            return labels;
                        }
                    }
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
