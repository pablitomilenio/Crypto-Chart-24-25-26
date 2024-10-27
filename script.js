// Leverage factor, default is 4x
const leverage = 7;

// Trailing Stop-Loss Percentage
const stopLossPercentage = 0.05;

// EnableExitingPositions
const exitingPositions = true;

// Binance Fees
//const makerFee = 0.02; // only for limit orders
const takerFee = 0.04;

const takerFeeDecimal = takerFee / 100; // Convert takerFee to decimal

// Position type: 1 for short, 2 for long
const positionType = 2; // Set to 1 for short, 2 for long

// Define the start and end dates for filtering
const startDate = '04/06/2021'; // MM/DD/YYYY
const endDate = '05/07/2021';   // MM/DD/YYYY

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

// Function to format numbers with thousands separator using uptick
function formatNumberWithUptick(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
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
    let numUnits;
    if (positionType === 1) { // Short
        numUnits = (cash * leverage) / entryPrice; // Number of units shorted
    } else { // Long
        numUnits = (cash / entryPrice) * leverage; // Number of units bought
    }
    let maxPrice = entryPrice; // Maximum price observed since entry
    let minPrice = entryPrice; // Minimum price observed since entry
    const portfolioValues = []; // Array to hold portfolio values
    const investmentStatus = []; // Array to hold investment status (true/false)
    const reinvestmentPoints = []; // Array to hold reinvestment dates and prices
    const stopLossPoints = []; // Array to hold stop-loss trigger dates and prices
    let stopLossTriggered = false; // Track if a stop-loss has recently triggered
    let reinvestmentCounter = 1; // Counter for reinvestment points labels

    for (let i = 0; i < closes.length; i++) {
        const price = closes[i];

        if (invested) {
            // Stop-loss logic
            let stopLossPrice;

            if (positionType === 1) { // Short
                stopLossPrice = minPrice * (1 + stopLossPercentage);
                if (price >= stopLossPrice && exitingPositions) {

                    // Stop-loss triggered
                    const profitLoss = (entryPrice - price) * numUnits;
                    cash += profitLoss;

                    // Compute fee
                    const transactionAmount = numUnits * price;
                    const fee = transactionAmount * takerFeeDecimal;
                    cash -= fee;

                    invested = false;
                    numUnits = 0;
                    stopLossTriggered = true;

                    portfolioValues.push(cash); // Record portfolio value
                    stopLossPoints.push({ date: dates[i], price: price });
                    console.log(`Stop-loss triggered (Short) on ${dates[i]} at price ${price.toFixed(2)}`);
                    investmentStatus.push(invested); // Record investment status
                    continue; // Skip reinvestment in this cycle
                }
            } else if (positionType === 2) { // Long
                stopLossPrice = maxPrice * (1 - stopLossPercentage);
                if (price <= stopLossPrice && exitingPositions) {
                    // Stop-loss triggered
                    const profitLoss = (price - entryPrice) * numUnits;
                    cash += profitLoss;

                    // Compute fee
                    const transactionAmount = numUnits * price;
                    const fee = transactionAmount * takerFeeDecimal;
                    cash -= fee;

                    invested = false;
                    numUnits = 0;
                    stopLossTriggered = true;

                    portfolioValues.push(cash); // Record portfolio value
                    stopLossPoints.push({ date: dates[i], price: price });
                    console.log(`Trailing Stop-loss triggered (Long) on ${dates[i]} at price ${price.toFixed(2)}`);
                    investmentStatus.push(invested); // Record investment status
                    continue; // Skip reinvestment in this cycle
                }
            }

            // Update trailing prices if invested
            if (positionType === 2) { // Long
                maxPrice = Math.max(maxPrice, price);
            } else if (positionType === 1) { // Short
                minPrice = Math.min(minPrice, price);
            }

            // Update portfolio value if position is still held
            let portfolioValue;
            if (positionType === 1) { // Short
                // Portfolio value = cash + initial proceeds - cost to buy back shares
                portfolioValue = cash + (entryPrice * numUnits) - (price * numUnits);
            } else { // Long
                const profitLoss = (price - entryPrice) * numUnits;
                portfolioValue = cash + profitLoss;
            }
            portfolioValues.push(portfolioValue);
        } else {
            // If stop-loss was triggered, wait for a future local max/min to reinvest
            if (stopLossTriggered && i > 0 && i < closes.length - 1) {
                const prevPrice = closes[i - 1];
                const nextPrice = closes[i + 1];

                if (positionType === 1 && price > prevPrice && price > nextPrice) { // Short re-invest at local max
                    invested = true;
                    entryPrice = price;
                    minPrice = price;
                    numUnits = (cash * leverage) / entryPrice;

                    // Compute fee
                    const transactionAmount = numUnits * entryPrice;
                    const fee = transactionAmount * takerFeeDecimal;
                    cash -= fee;

                    reinvestmentPoints.push({ date: dates[i], price: price, label: reinvestmentCounter });
                    console.log(`Re-invested (Short) on ${dates[i]} at price ${price.toFixed(2)}`);
                    stopLossTriggered = false; // Reset the stop-loss flag

                    reinvestmentCounter++; // Increment the counter
                } else if (positionType === 2 && price < prevPrice && price < nextPrice) { // Long re-invest at local min
                    invested = true;
                    entryPrice = price;
                    maxPrice = price;
                    numUnits = (cash / entryPrice) * leverage;

                    // Compute fee
                    const transactionAmount = numUnits * entryPrice;
                    const fee = transactionAmount * takerFeeDecimal;
                    cash -= fee;

                    reinvestmentPoints.push({ date: dates[i], price: price, label: reinvestmentCounter });
                    console.log(`Re-invested (Long) on ${dates[i]} at price ${price.toFixed(2)}`);
                    stopLossTriggered = false; // Reset the stop-loss flag

                    reinvestmentCounter++; // Increment the counter
                }
            }
            portfolioValues.push(cash); // No position: constant portfolio value
        }

        // Record investment status
        investmentStatus.push(invested);
    }

    // Get the canvas context
    const ctx = document.getElementById('myChart').getContext('2d');

    // Store initial values for percentage calculations
    const initialClosePrice = closes[0];
    const initialPortfolioValue = portfolioValues[0];

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
                    tension: 0.1,
                    datalabels: {
                        display: false
                    },
                },
                {
                    label: 'Reinvestment Points',
                    data: reinvestmentPoints.map(point => ({ x: point.date, y: point.price, label: point.label })),
                    yAxisID: 'y',
                    type: 'scatter',
                    pointRadius: 6,
                    pointBackgroundColor: 'green',
                    showLine: false,
                    datalabels: {
                        align: 'top',
                        color: 'lightgray',
                        formatter: function (value, context) {
                            return value.label;
                        }
                    }
                },
                {
                    label: 'Stop-Loss Points',
                    data: stopLossPoints.map(point => ({ x: point.date, y: point.price })),
                    yAxisID: 'y',
                    type: 'scatter',
                    pointRadius: 6,
                    pointBackgroundColor: 'red',
                    showLine: false,
                    datalabels: {
                        display: false
                    },
                },
                {
                    label: 'Portfolio Value',
                    data: portfolioValues,
                    yAxisID: 'y1',
                    borderColor: 'magenta',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1,
                    datalabels: {
                        display: false
                    },
                    segment: {
                        borderColor: ctx => {
                            const index = ctx.p0DataIndex;
                            const invested = investmentStatus[index];
                            return invested ? 'magenta' : 'white';
                        }
                    }
                },
                // Added dataset for "Uninvested" label
                {
                    label: 'Uninvested',
                    data: [NaN], // No data to plot
                    borderColor: 'white',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    showLine: false, // Do not draw a line
                    yAxisID: 'y1'
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
                        text: 'Date',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Close Price (USD)',
                        color: 'yellow'
                    },
                    ticks: {
                        color: 'yellow',
                        callback: function (value) {
                            const percentageChange = ((value - initialClosePrice) / initialClosePrice) * 100;
                            return `$${value.toFixed(2)} (${Math.round(percentageChange)}%)`;
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Portfolio Value (USD)',
                        color: 'magenta'
                    },
                    ticks: {
                        color: 'pink',
                        callback: function (value) {
                            const percentageChange = ((value - initialPortfolioValue) / initialPortfolioValue) * 100;
                            return `$${formatNumberWithUptick(Math.round(value))} (${Math.round(percentageChange)}%)`;
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (context.parsed.y !== null && !isNaN(context.parsed.y)) {
                                let value = context.parsed.y;
                                let formattedValue = context.dataset.yAxisID === 'y'
                                    ? `$${value.toFixed(2)}`
                                    : `$${formatNumberWithUptick(Math.round(value))}`;
                                let percentageChange = ((value - (context.dataset.yAxisID === 'y' ? initialClosePrice : initialPortfolioValue)) / (context.dataset.yAxisID === 'y' ? initialClosePrice : initialPortfolioValue)) * 100;
                                label += `: ${formattedValue} (${Math.round(percentageChange)}%)`;
                            }
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        initialValueLine: {
                            type: 'line',
                            scaleID: 'y1',
                            value: initialPortfolioValue,
                            borderColor: 'cyan',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                enabled: true,
                                content: `Initial Portfolio Value: $${formatNumberWithUptick(Math.round(initialPortfolioValue))}`,
                                position: 'start',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'cyan',
                                font: {
                                    size: 12
                                },
                                yAdjust: -10
                            }
                        }
                    }
                },
                // Include datalabels plugin
                datalabels: {
                    // Global options for datalabels if needed
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
    document.body.style.background = 'linear-gradient(to bottom, darkgray, black)';
    const canvas = document.getElementById('myChart');
    canvas.style.backgroundColor = 'transparent';

    // Register the annotation plugin and the datalabels plugin
    Chart.register(window['chartjs-plugin-annotation'], window['ChartDataLabels']);

    readCSV(function (csvData) {
        const jsonData = parseCSV(csvData);
        renderChart(jsonData);
    });
};
