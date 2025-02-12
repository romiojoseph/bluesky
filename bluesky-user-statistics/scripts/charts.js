function generatePostsHeatmap(records) {
    const container = document.getElementById('postsHeatmapContainer');
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === 'app.bsky.feed.post');
    if (typeRecords.length === 0) {
        container.textContent = 'No data available for Posts.';
        return;
    }

    createHeatmapForType(typeRecords, container, 'Posts');
}

function generateLikesHeatmap(records) {
    const container = document.getElementById('likesHeatmapContainer');
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === 'app.bsky.feed.like');
    if (typeRecords.length === 0) {
        container.textContent = 'No data available for Likes.';
        return;
    }

    createHeatmapForType(typeRecords, container, 'Likes');
}

function generateRepostsHeatmap(records) {
    const container = document.getElementById('repostsHeatmapContainer');
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === 'app.bsky.feed.repost');
    if (typeRecords.length === 0) {
        container.textContent = 'No data available for Reposts.';
        return;
    }

    createHeatmapForType(typeRecords, container, 'Reposts');
}

function generateFollowsHeatmap(records) {
    const container = document.getElementById('followsHeatmapContainer');
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === 'app.bsky.graph.follow');
    if (typeRecords.length === 0) {
        container.textContent = 'No data available for Follows.';
        return;
    }

    createHeatmapForType(typeRecords, container, 'Follows');
}

function createHeatmapForType(records, container, typeName) {
    const years = Array.from(new Set(records.map(record => record.createdAt ? new Date(record.createdAt).getUTCFullYear() : null))).filter(year => year !== null).sort((a, b) => b - a); // Sort in descending order

    if (years.length === 0) {
        container.textContent = `No data available for ${typeName}.`;
        return;
    }

    // Calculate total count for all years
    const totalCount = records.length;

    // Display total count
    const totalCountDisplay = document.createElement('div');
    totalCountDisplay.textContent = `Total ${typeName}: ${totalCount.toLocaleString()}`;
    totalCountDisplay.style.marginBottom = '10px'; // Add some spacing
    totalCountDisplay.style.fontWeight = 'bold'; // Make it stand out
    container.appendChild(totalCountDisplay);

    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-container';
    container.appendChild(tabsContainer);

    // Create tab content container
    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'tab-content-container';
    container.appendChild(tabContentContainer);

    // Create a single tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '6px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    tooltip.style.zIndex = '1000';
    document.body.appendChild(tooltip); // Append to body for correct positioning

    years.forEach((year, index) => {
        // Filter records for the current year
        const recordsForYear = records.filter(record => record.createdAt && new Date(record.createdAt).getUTCFullYear() === year);
        const yearTotalCount = recordsForYear.length;

        // Create tab button
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        tabButton.textContent = year;
        tabButton.addEventListener('click', () => {
            // Remove active class from all buttons *within this section*
            tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            // Hide tab content *within this section*
            tabContentContainer.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

            // Add active class to the clicked button and show corresponding content
            tabButton.classList.add('active');
            document.getElementById(`${typeName.toLowerCase()}-tab-content-${year}`).style.display = 'block';
        });
        tabsContainer.appendChild(tabButton);

        // Set first tab as active by default
        if (index === 0) {
            tabButton.classList.add('active');
        }

        // Create tab content div
        const tabContent = document.createElement('div');
        tabContent.id = `${typeName.toLowerCase()}-tab-content-${year}`;
        tabContent.className = 'tab-content';
        tabContent.style.display = index === 0 ? 'block' : 'none'; // Show first tab content by default
        tabContentContainer.appendChild(tabContent);

        // Display total count for the year
        const yearTotalCountDisplay = document.createElement('div');
        yearTotalCountDisplay.textContent = `Total ${typeName} in ${year}: ${yearTotalCount.toLocaleString()}`;
        yearTotalCountDisplay.style.marginTop = '10px';
        yearTotalCountDisplay.style.marginBottom = '10px';
        yearTotalCountDisplay.style.fontWeight = 'bold';
        tabContent.appendChild(yearTotalCountDisplay);  // Add to tabContent

        const dataByYear = {};

        // Process records and count occurrences per date for the current year
        // Use recordsForYear here
        recordsForYear.forEach(record => {
            const date = new Date(record.createdAt);
            const month = date.getUTCMonth();
            const day = date.getUTCDate();
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            if (!dataByYear[dateKey]) {
                dataByYear[dateKey] = 0;
            }
            dataByYear[dateKey]++;
        });

        // Find the highest count among all dates for the current year
        let globalMax = 0;
        Object.keys(dataByYear).forEach(dateKey => {
            globalMax = Math.max(globalMax, dataByYear[dateKey]);
        });

        // Compute step for nonzero values (divide range into 5 equal parts)
        const step = globalMax > 0 ? globalMax / 5 : 1;

        // Define the color scale (6 colors for 6 divisions: 0 and five steps)
        const colors = ['#F1F3FC', '#B5D1FF', '#7CAEFF', '#4089FF', '#0866FF', '#0050D2'];

        const yearDiv = document.createElement('div');
        yearDiv.style.marginBottom = '20px';

        const title = document.createElement('h3');
        title.textContent = `${typeName} - ${year}`;
        yearDiv.appendChild(title);

        const heatmapDiv = document.createElement('div');
        heatmapDiv.className = 'calendar-heatmap';
        heatmapDiv.style.width = '100%';
        heatmapDiv.style.maxWidth = '960px';
        heatmapDiv.style.overflowX = 'auto';
        yearDiv.appendChild(heatmapDiv);

        const legendDiv = document.createElement('div');
        legendDiv.className = 'legend';
        yearDiv.appendChild(legendDiv);

        tabContent.appendChild(yearDiv); // Append yearDiv to tabContent

        // Create header row
        const headerRow = document.createElement('div');
        headerRow.className = 'header-row';
        headerRow.style.display = 'grid';
        headerRow.style.gridTemplateColumns = '50px repeat(31, minmax(20px, 1fr))';
        headerRow.style.gap = '3px';

        const emptyCell = document.createElement('div');
        emptyCell.style.width = '50px';
        headerRow.appendChild(emptyCell);

        for (let i = 1; i <= 31; i++) {
            const dayLabel = document.createElement('div');
            dayLabel.textContent = i;
            dayLabel.style.fontSize = '10px';
            dayLabel.style.textAlign = 'center';
            headerRow.appendChild(dayLabel);
        }
        heatmapDiv.appendChild(headerRow);

        // Create month rows
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((month, monthIndex) => {
            const monthRow = document.createElement('div');
            monthRow.className = 'month-row';
            monthRow.style.display = 'grid';
            monthRow.style.gridTemplateColumns = '50px repeat(31, minmax(20px, 1fr))';
            monthRow.style.gap = '3px';
            monthRow.style.marginBottom = '3px';

            const monthLabel = document.createElement('div');
            monthLabel.textContent = month;
            monthLabel.style.fontSize = '12px';
            monthLabel.style.alignSelf = 'center';
            monthLabel.style.width = '50px';
            monthRow.appendChild(monthLabel);

            for (let day = 1; day <= 31; day++) {
                const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const value = dataByYear[dateKey] || 0;

                const cell = document.createElement('div');
                cell.className = 'day-cell';

                const date = new Date(year, monthIndex, day);
                if (date.getMonth() === monthIndex) {
                    let colorIndex;
                    if (value === 0) {
                        colorIndex = 0;
                    } else {
                        colorIndex = Math.min(5, Math.floor((value - 1) / step) + 1);
                    }
                    cell.style.backgroundColor = colors[colorIndex];
                    cell.style.height = '20px';
                    cell.style.borderRadius = '2px';

                    // Tooltip
                    cell.addEventListener('mouseover', (e) => {
                        tooltip.innerHTML = `${date.toDateString()}<br>Count: ${value}`;
                        tooltip.style.left = `${e.clientX + 10}px`; // Position tooltip
                        tooltip.style.top = `${e.clientY + 10}px`;
                        tooltip.style.display = 'block';
                    });

                    cell.addEventListener('mouseout', () => {
                        tooltip.style.display = 'none';
                    });
                }
                monthRow.appendChild(cell);
            }
            heatmapDiv.appendChild(monthRow);
        });

        // Create legend
        let legendRanges = [];
        if (globalMax > 0) {
            const stepSize = Math.ceil(globalMax / 5);
            legendRanges.push("0");
            for (let i = 1; i <= 5; i++) {
                let lower = (i - 1) * stepSize + 1;
                let upper = i * stepSize;
                if (i === 5) {
                    upper = globalMax;
                }
                if (lower === upper) {
                    legendRanges.push(`${lower}`);
                } else {
                    legendRanges.push(`${lower}-${upper}`);
                }
            }
        } else {
            legendRanges = ["0", "0", "0", "0", "0", "0"];
        }

        colors.forEach((color, i) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" style="background: ${color};"></div>
                <span>${legendRanges[i]}</span>
            `;
            legendDiv.appendChild(legendItem);
        });
    });
}

function generatePostsHourlyBarChart(records) {
    const container = document.getElementById('postsHourlyBarChartContainer');
    createHourlyBarChartForType(records, container, 'app.bsky.feed.post', 'Posts');
}

function generatePostsWeeklyBarChart(records) {
    const container = document.getElementById('postsWeeklyBarChartContainer');
    createWeeklyBarChartForType(records, container, 'app.bsky.feed.post', 'Posts');
}

function generateLikesHourlyBarChart(records) {
    const container = document.getElementById('likesHourlyBarChartContainer');
    createHourlyBarChartForType(records, container, 'app.bsky.feed.like', 'Likes');
}

function generateLikesWeeklyBarChart(records) {
    const container = document.getElementById('likesWeeklyBarChartContainer');
    createWeeklyBarChartForType(records, container, 'app.bsky.feed.like', 'Likes');
}

function generateRepostsHourlyBarChart(records) {
    const container = document.getElementById('repostsHourlyBarChartContainer');
    createHourlyBarChartForType(records, container, 'app.bsky.feed.repost', 'Reposts');
}

function generateRepostsWeeklyBarChart(records) {
    const container = document.getElementById('repostsWeeklyBarChartContainer');
    createWeeklyBarChartForType(records, container, 'app.bsky.feed.repost', 'Reposts');
}

function generateFollowsHourlyBarChart(records) {
    const container = document.getElementById('followsHourlyBarChartContainer');
    createHourlyBarChartForType(records, container, 'app.bsky.graph.follow', 'Follows');
}

function generateFollowsWeeklyBarChart(records) {
    const container = document.getElementById('followsWeeklyBarChartContainer');
    createWeeklyBarChartForType(records, container, 'app.bsky.graph.follow', 'Follows');
}

function createHourlyBarChartForType(records, container, recordType, typeName) {
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === recordType);
    if (typeRecords.length === 0) {
        container.textContent = `No data available for ${typeName} (Hourly).`;
        return;
    }

    const barChartContainer = document.createElement('div');
    barChartContainer.className = 'bar-chart-container';

    // Add title first
    const title = document.createElement('h3');
    title.textContent = `${typeName} - Hourly Activity`;
    barChartContainer.appendChild(title);

    // Create chart div with border
    const chartDiv = document.createElement('div');
    chartDiv.className = 'bar-chart';
    barChartContainer.appendChild(chartDiv);

    const hourlyCounts = Array(24).fill(0);
    typeRecords.forEach(record => {
        if (record.createdAt) {
            // Convert UTC to local time
            const localDate = new Date(record.createdAt);
            const localHour = localDate.getHours();
            hourlyCounts[localHour]++;
        }
    });

    const maxValue = Math.max(...hourlyCounts);

    // 12-hour format labels
    const labels = Array.from({ length: 24 }, (_, i) => {
        const hour = i % 12 || 12; // Convert 0 to 12
        const period = i < 12 ? 'AM' : 'PM';
        return `${hour}${period}`;
    });

    hourlyCounts.forEach((count, i) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${(count / maxValue) * 100}%`;
        bar.style.backgroundColor = '#CC48FE'; // You can use different colors
        bar.style.flex = '1';
        bar.style.borderRadius = '3px 3px 0 0';

        bar.addEventListener('mouseover', (e) => {
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `${labels[i]}<br>Count: ${count}`;
            tooltip.style.position = 'absolute';
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '1000';
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
            document.body.appendChild(tooltip);

            bar.addEventListener('mouseout', () => {
                if (document.body.contains(tooltip)) {
                    document.body.removeChild(tooltip);
                }
            });
        });

        chartDiv.appendChild(bar);
    });

    // Add x-axis labels container
    const xAxisLabels = document.createElement('div');
    xAxisLabels.className = 'x-axis-labels';
    xAxisLabels.style.display = 'flex';
    xAxisLabels.style.justifyContent = 'space-between';
    xAxisLabels.style.padding = '0 20px';
    xAxisLabels.style.marginTop = '5px';
    barChartContainer.appendChild(xAxisLabels);

    // Add labels
    labels.forEach(label => {
        const labelDiv = document.createElement('div');
        labelDiv.style.flex = '1';
        labelDiv.style.textAlign = 'center';
        labelDiv.style.fontSize = '10px';
        labelDiv.textContent = label;
        xAxisLabels.appendChild(labelDiv);
    });

    container.appendChild(barChartContainer);
}

function createWeeklyBarChartForType(records, container, recordType, typeName) {
    container.innerHTML = ''; // Clear any existing content

    const typeRecords = records.filter(record => record.type === recordType);
    if (typeRecords.length === 0) {
        container.textContent = `No data available for ${typeName} (Weekly).`;
        return;
    }

    const barChartContainer = document.createElement('div');
    barChartContainer.className = 'bar-chart-container';

    // Add title first
    const title = document.createElement('h3');
    title.textContent = `${typeName} - Weekly Activity`;
    barChartContainer.appendChild(title);

    const chartDiv = document.createElement('div');
    chartDiv.className = 'bar-chart';
    barChartContainer.appendChild(chartDiv);

    const weeklyCounts = Array(7).fill(0); // 0: Sunday, 1: Monday, ..., 6: Saturday
    typeRecords.forEach(record => {
        if (record.createdAt) {
            // Convert UTC to local time
            const localDate = new Date(record.createdAt);
            const localDay = localDate.getDay(); // 0 (Sunday) to 6 (Saturday)
            weeklyCounts[localDay]++;
        }
    });

    const maxValue = Math.max(...weeklyCounts);

    weeklyCounts.forEach((count, i) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${(count / maxValue) * 100}%`;
        bar.style.backgroundColor = '#7148fc'; // Different color for weekly chart
        bar.style.flex = '1';
        bar.style.borderRadius = '3px 3px 0 0';

        bar.addEventListener('mouseover', (e) => {
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `Count: ${count}`;
            tooltip.style.position = 'absolute';
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '1000';
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
            document.body.appendChild(tooltip);

            bar.addEventListener('mouseout', () => {
                if (document.body.contains(tooltip)) {
                    document.body.removeChild(tooltip);
                }
            });
        });

        chartDiv.appendChild(bar);
    });

    // Add x-axis labels container
    const xAxisLabels = document.createElement('div');
    xAxisLabels.className = 'x-axis-labels';
    xAxisLabels.style.display = 'flex';
    xAxisLabels.style.justifyContent = 'space-between';
    xAxisLabels.style.padding = '0 20px';
    xAxisLabels.style.marginTop = '5px';
    barChartContainer.appendChild(xAxisLabels);

    // Add labels
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekDays.forEach(label => {
        const labelDiv = document.createElement('div');
        labelDiv.style.flex = '1';
        labelDiv.style.textAlign = 'center';
        labelDiv.style.fontSize = '10px';
        labelDiv.textContent = label;
        xAxisLabels.appendChild(labelDiv);
    });

    container.appendChild(barChartContainer);
}